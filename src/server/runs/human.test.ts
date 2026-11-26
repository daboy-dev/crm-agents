import { describe, expect, it } from "vitest";
import { checkPrecondition, type HumanAction, type RunView } from "./human";
import type { RunStatus } from "./machine";

const view = (
  status: RunStatus,
  planRevision = 1,
  headSha: string | null = null,
): RunView => ({ status, planRevision, headSha });

type Row = {
  name: string;
  action: HumanAction;
  seen: RunView;
  now: RunView;
  /** ok, already or changed. */
  expected: "ok" | "already" | "changed";
  message?: string;
};

const table: Row[] = [
  // approve_plan: the revision on screen.
  {
    name: "approve the plan on screen",
    action: "approve_plan",
    seen: view("awaiting_plan_approval", 2),
    now: view("awaiting_plan_approval", 2),
    expected: "ok",
  },
  {
    name: "a newer revision is waiting",
    action: "approve_plan",
    seen: view("awaiting_plan_approval", 2),
    now: view("awaiting_plan_approval", 3),
    expected: "changed",
    message: "revisa la revisión 3",
  },
  {
    name: "approved in another tab",
    action: "approve_plan",
    seen: view("awaiting_plan_approval", 2),
    now: view("developing", 2),
    expected: "already",
    message: "Ya estaba aprobado.",
  },
  {
    name: "approved and already testing",
    action: "approve_plan",
    seen: view("awaiting_plan_approval", 1),
    now: view("awaiting_preview", 1, "abc"),
    expected: "already",
  },
  {
    name: "sent back to planning in another tab",
    action: "approve_plan",
    seen: view("awaiting_plan_approval", 1),
    now: view("planning", 2),
    expected: "changed",
  },
  // approve_final: the sha on screen.
  {
    name: "approve the preview on screen",
    action: "approve_final",
    seen: view("awaiting_final_approval", 1, "aaa1111"),
    now: view("awaiting_final_approval", 1, "aaa1111"),
    expected: "ok",
  },
  {
    name: "another head is waiting",
    action: "approve_final",
    seen: view("awaiting_final_approval", 1, "aaa1111"),
    now: view("awaiting_final_approval", 2, "bbb2222"),
    expected: "changed",
    message: "bbb2222",
  },
  {
    name: "already merging that sha",
    action: "approve_final",
    seen: view("awaiting_final_approval", 1, "aaa1111"),
    now: view("merging", 1, "aaa1111"),
    expected: "already",
  },
  {
    name: "already merged",
    action: "approve_final",
    seen: view("awaiting_final_approval", 1, "aaa1111"),
    now: view("done", 1, "aaa1111"),
    expected: "already",
  },
  {
    name: "final approval timed out",
    action: "approve_final",
    seen: view("awaiting_final_approval", 1, "aaa1111"),
    now: view("cancelled", 1, "aaa1111"),
    expected: "changed",
  },
  // reject: same status, revision and sha.
  {
    name: "reject what is on screen",
    action: "reject",
    seen: view("awaiting_final_approval", 1, "aaa"),
    now: view("awaiting_final_approval", 1, "aaa"),
    expected: "ok",
  },
  {
    name: "feedback already sent",
    action: "reject",
    seen: view("awaiting_plan_approval", 1),
    now: view("planning", 2),
    expected: "already",
  },
  {
    name: "rejected in another tab",
    action: "reject",
    seen: view("awaiting_plan_approval", 1),
    now: view("rejected", 1),
    expected: "already",
  },
  {
    name: "plan approved before the rejection",
    action: "reject",
    seen: view("awaiting_plan_approval", 1),
    now: view("developing", 1),
    expected: "changed",
  },
  // retry and abandon from blocked.
  {
    name: "retry a blocked run",
    action: "retry",
    seen: view("blocked"),
    now: view("blocked"),
    expected: "ok",
  },
  {
    name: "retried in another tab",
    action: "retry",
    seen: view("blocked"),
    now: view("developing"),
    expected: "already",
  },
  {
    name: "abandon a blocked run",
    action: "cancel",
    seen: view("blocked"),
    now: view("blocked"),
    expected: "ok",
  },
  {
    name: "abandon after a retry elsewhere",
    action: "cancel",
    seen: view("blocked"),
    now: view("developing"),
    expected: "changed",
  },
  // cancel while the agents work.
  {
    name: "cancel while the status moves on",
    action: "cancel",
    seen: view("developing"),
    now: view("awaiting_preview", 1, "abc"),
    expected: "ok",
  },
  {
    name: "cancel when the run now waits for the human",
    action: "cancel",
    seen: view("testing"),
    now: view("awaiting_final_approval", 1, "abc"),
    expected: "changed",
  },
  {
    name: "cancelled in another tab",
    action: "cancel",
    seen: view("developing"),
    now: view("cancelled"),
    expected: "already",
    message: "Ya estaba cancelado.",
  },
  {
    name: "cancel a finished run",
    action: "cancel",
    seen: view("merging"),
    now: view("done"),
    expected: "changed",
  },
];

describe("checkPrecondition (D47)", () => {
  it.each(table)("$name", ({ action, seen, now, expected, message }) => {
    const result = checkPrecondition(action, seen, now);
    const got = result.ok ? "ok" : result.already ? "already" : "changed";
    expect(got).toBe(expected);
    if (message && !result.ok) expect(result.message).toContain(message);
  });
});
