import { describe, expect, it } from "vitest";
import { breakTestId, usesTestId } from "./test-ids";

describe("usesTestId (D38)", () => {
  it("finds a literal data-testid in JSX or in an object", () => {
    expect(
      usesTestId("invoice-status-filter", [
        '<select data-testid="invoice-status-filter">',
      ]),
    ).toBe(true);
    expect(
      usesTestId("client-notes", [
        '{ label: "Notas", testId: "client-notes" }',
      ]),
    ).toBe(true);
    expect(usesTestId("client-notes", ["<p>client-notes</p>"])).toBe(false);
  });

  it("knows the data-testid crm-demo builds", () => {
    expect(
      usesTestId("field-notes", ['<Field name="notes" label="Notas" />']),
    ).toBe(true);
    expect(
      usesTestId("item-0-description", [
        "data-testid={`item-${i}-description`}",
      ]),
    ).toBe(true);
    expect(
      usesTestId("nav-resumen", ['{ href: "/resumen", label: "Resumen" }']),
    ).toBe(true);
    expect(usesTestId("field-notes", ['<Field name="note" />'])).toBe(false);
  });
});

describe("breakTestId (D40)", () => {
  it("renames the first data-testid written literally", () => {
    const files = [
      { path: "a.tsx", content: '<b data-testid="x-filter" />' },
      { path: "b.tsx", content: '<i data-testid="x-filter" />' },
    ];
    const done = breakTestId(files, ["missing", "x-filter"]);
    expect(done?.testId).toBe("x-filter");
    expect(done?.files.map((f) => f.content)).toEqual([
      '<b data-testid="x-filter-simulated" />',
      '<i data-testid="x-filter-simulated" />',
    ]);
  });

  it("never renames one the files already had (run #21)", () => {
    const files = [
      {
        path: "page.tsx",
        content:
          '<div data-testid="client-detail"><p data-testid="client-notes" /></div>',
      },
    ];
    const done = breakTestId(
      files,
      ["client-detail", "client-notes"],
      ['<div data-testid="client-detail" />'],
    );
    expect(done?.testId).toBe("client-notes");
    expect(done?.files[0]!.content).toContain('data-testid="client-detail"');
  });

  it("does nothing when no data-testid is literal", () => {
    expect(
      breakTestId(
        [{ path: "a.tsx", content: '<Field name="notes" />' }],
        ["field-notes"],
      ),
    ).toBeNull();
  });
});
