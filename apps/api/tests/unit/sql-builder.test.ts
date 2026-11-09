import { describe, expect, it } from "vitest";
import { join, raw, sql } from "../../src/db/sql.js";

describe("sql template", () => {
  it("parameterises interpolated values", () => {
    const fragment = sql`SELECT * FROM dbo.Users WHERE Email = ${"a@b.c"} AND Id = ${3}`;
    const { text, params } = fragment.compile();
    expect(text).toBe("SELECT * FROM dbo.Users WHERE Email = @p0 AND Id = @p1");
    expect(params).toEqual(["a@b.c", 3]);
  });

  it("splices nested fragments and raw identifiers", () => {
    const where = join([sql`Status = ${"todo"}`, sql`Priority = ${"high"}`], " AND ");
    const fragment = sql`SELECT * FROM ${raw("dbo.Tasks")} WHERE ${where}`;
    const { text, params } = fragment.compile();
    expect(text).toBe("SELECT * FROM dbo.Tasks WHERE Status = @p0 AND Priority = @p1");
    expect(params).toEqual(["todo", "high"]);
  });
});
