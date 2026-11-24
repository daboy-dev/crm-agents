import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { isUniqueViolation, transitionStatement } from "./store";

// Never connects: only builds SQL.
const db = drizzle(neon("postgresql://u:p@db.example.com/x"), { schema });
const dialect = new PgDialect();

describe("transitionStatement", () => {
  const query = dialect.sqlToQuery(
    transitionStatement(db, {
      runId: 7,
      version: 3,
      leaseToken: "tok",
      set: { status: "awaiting_preview" },
      events: [
        { actor: "develop", kind: "commit", message: "m1", data: { a: 1 } },
        { actor: "system", kind: "pushed", message: "m2" },
      ],
      tasks: [{ id: 11, set: { status: "testing" } }],
    }),
  );
  const text = query.sql.replace(/\s+/g, " ");

  it("is a compare-and-swap on id, version and lease", () => {
    expect(text).toMatch(/^with upd as \(update "runs" set /);
    expect(text).toContain('"version" = "runs"."version" + 1');
    expect(text).toMatch(
      /where \("runs"\."id" = \$\d+ and "runs"\."version" = \$\d+ and "runs"\."lease_token" = \$\d+\)/,
    );
    expect(query.params).toEqual(expect.arrayContaining([7, 3, "tok"]));
  });

  it("only writes events and tasks when the run row was updated", () => {
    expect(text).toContain('ev0 as (insert into "run_events"');
    expect(text).toContain('ev1 as (insert into "run_events"');
    expect(text.match(/::jsonb from upd\)/g)).toHaveLength(2);
    expect(text).toMatch(
      /tk0 as \(update "tasks" set "status" = \$\d+ where \("tasks"\."id" = \$\d+ and "tasks"\."run_id" in \(select id from upd\)\)\)/,
    );
    expect(text).toMatch(/select id, version from upd$/);
  });

  it("serializes event data as jsonb", () => {
    expect(query.params).toContain('{"a":1}');
    expect(query.params).toContain(null);
  });
});

describe("isUniqueViolation", () => {
  it("reads the code from the error or its cause", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});
