import { describe, expect, it } from "vitest";
import { DEMO_REQUESTS, demoRequests, normalizeRequest } from "./demo-requests";

describe("demoRequests (D48)", () => {
  it("nothing merged yet", () => {
    expect(demoRequests([]).every((d) => !d.merged)).toBe(true);
  });

  it("marks a suggestion whose run ended in done, whatever the spacing", () => {
    const first = DEMO_REQUESTS[0]!.request;
    const typed = `  ${first.toUpperCase().replace(/ /g, "  ").replace(/\.$/, "")}  `;
    const got = demoRequests([typed, "otra petición"]);
    expect(got[0]!.merged).toBe(true);
    expect(got.slice(1).every((d) => !d.merged)).toBe(true);
  });

  it("normalizes case, spaces and the final period", () => {
    expect(normalizeRequest(" Añade  el NIF. ")).toBe("añade el nif");
  });

  it("every suggestion passes the form's length rule", () => {
    for (const d of DEMO_REQUESTS) {
      expect(d.request.length).toBeGreaterThanOrEqual(10);
      expect(d.request.length).toBeLessThanOrEqual(2000);
    }
  });
});
