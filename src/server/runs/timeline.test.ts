import { describe, expect, it } from "vitest";
import {
  eventAgent,
  parseFilter,
  sameContext,
  timelineItems,
  type TimelineEvent,
} from "./timeline";

const context = (taskId: number, iteration: number, sha = "abc") => ({
  taskId,
  iteration,
  sha,
  files: [{ path: "src/app/clientes/page.tsx", role: "target" }],
  trimmed: [],
  newFiles: [],
});

let id = 0;
const ev = (
  actor: string,
  kind: string,
  data: unknown = null,
): TimelineEvent => ({
  id: ++id,
  actor,
  kind,
  message: `${actor} ${kind}`,
  data,
  at: new Date(Date.UTC(2026, 10, 26, 10, id)),
});

const shape = (items: ReturnType<typeof timelineItems>) =>
  items.map((i) =>
    i.kind === "event"
      ? i.event.kind
      : i.kind === "retries"
        ? `${i.events[0]!.kind}×${i.events.length}`
        : `--- it${i.iteration} r${i.revision}`,
  );

describe("sameContext (D44)", () => {
  it("the same files of the same task and iteration are not logged again", () => {
    // jsonb gives the object back with its own key order.
    const stored = JSON.parse(JSON.stringify(context(1, 1)));
    expect(sameContext(stored, context(1, 1))).toBe(true);
  });

  it("another iteration, head or file list is logged", () => {
    expect(sameContext(context(1, 1), context(1, 2))).toBe(false);
    expect(sameContext(context(1, 1), context(1, 1, "def"))).toBe(false);
    expect(sameContext(context(1, 1), { ...context(1, 1), files: [] })).toBe(
      false,
    );
    expect(sameContext(null, context(1, 1))).toBe(false);
  });
});

describe("eventAgent (D44)", () => {
  it.each([
    [{ actor: "develop", kind: "commit" }, "develop"],
    [{ actor: "human", kind: "approved" }, "human"],
    [{ actor: "system", kind: "check_failed" }, "develop"],
    [{ actor: "system", kind: "pushed" }, "develop"],
    [{ actor: "github", kind: "preview" }, "testing"],
    [{ actor: "github", kind: "report" }, "testing"],
    [{ actor: "system", kind: "report" }, "testing"],
    [{ actor: "system", kind: "merged" }, "human"],
    [{ actor: "system", kind: "overloaded" }, null],
  ] as const)("%o → %s", (e, agent) => {
    expect(eventAgent(e)).toBe(agent);
  });

  it("parses the filter of the URL", () => {
    expect(parseFilter("develop")).toBe("develop");
    expect(parseFilter(["testing", "x"])).toBe("testing");
    expect(parseFilter("nadie")).toBe("todos");
    expect(parseFilter(undefined)).toBe("todos");
  });
});

describe("timelineItems (D44)", () => {
  const events = [
    ev("human", "request"),
    ev("orchestrator", "plan"),
    ev("human", "approved"),
    ev("testing", "steps"),
    ev("develop", "context", context(1, 1)),
    ev("system", "overloaded"),
    ev("system", "overloaded"),
    ev("system", "overloaded"),
    ev("system", "rate_limited"),
    ev("develop", "context", context(2, 1)),
    ev("develop", "commit"),
    ev("system", "check_passed"),
    ev("github", "report"),
    ev("testing", "explain"),
    ev("develop", "context", context(2, 2)),
    ev("develop", "commit"),
    ev("orchestrator", "plan"),
    ev("develop", "context", context(3, 1)),
  ];

  it("groups retries and separates each round", () => {
    expect(shape(timelineItems(events, "todos"))).toEqual([
      "request",
      "plan",
      "approved",
      "steps",
      "--- it1 r1",
      "context",
      "overloaded×3",
      "rate_limited×1",
      "context",
      "commit",
      "check_passed",
      "report",
      "explain",
      "--- it2 r1",
      "context",
      "commit",
      "plan",
      "--- it1 r2",
      "context",
    ]);
  });

  it("keeps every retry inside its group", () => {
    const group = timelineItems(events, "todos").find(
      (i) => i.kind === "retries",
    );
    expect(group?.kind === "retries" && group.events).toHaveLength(3);
  });

  it("filters by agent, with the waits of the agent that waits", () => {
    expect(shape(timelineItems(events, "develop"))).toEqual([
      "--- it1 r1",
      "context",
      "context",
      "commit",
      "check_passed",
      "--- it2 r1",
      "context",
      "commit",
      "--- it1 r2",
      "context",
    ]);
    expect(shape(timelineItems(events, "humano"))).toEqual([
      "request",
      "approved",
    ]);
  });
});
