import { describe, expect, it } from "vitest";
import { parseTab, runHref } from "./view-params";

describe("parseTab (D46)", () => {
  it("opens the preview when the human has to approve it", () => {
    expect(parseTab(undefined, "awaiting_final_approval")).toBe("vista-previa");
    expect(parseTab(undefined, "developing")).toBe("tareas");
  });

  it("keeps the tab of the URL", () => {
    expect(parseTab("linea", "awaiting_final_approval")).toBe("linea");
    expect(parseTab(["vista-previa"], "developing")).toBe("vista-previa");
    expect(parseTab("otra", "developing")).toBe("tareas");
  });
});

describe("runHref", () => {
  it("keeps the other parameter and drops the defaults", () => {
    const status = "developing";
    expect(runHref(30, { agente: "todos", tab: "tareas", status })).toBe(
      "/runs/30",
    );
    expect(runHref(30, { agente: "develop", tab: "linea", status })).toBe(
      "/runs/30?agente=develop&tab=linea",
    );
    expect(
      runHref(30, {
        agente: "todos",
        tab: "vista-previa",
        status: "awaiting_final_approval",
      }),
    ).toBe("/runs/30");
  });
});
