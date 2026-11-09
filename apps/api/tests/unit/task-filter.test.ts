import { describe, expect, it } from "vitest";
import { buildTaskConditions } from "../../src/modules/tasks/repo.js";

describe("buildTaskConditions", () => {
  it("parameterises an open due-date window", () => {
    const { text, params } = buildTaskConditions({ open: true, dueFrom: "2026-11-09", dueTo: "2026-11-09" }).compile();
    expect(text).toContain("t.Status <> 'done'");
    expect(text).toContain("t.DueDate >=");
    expect(text).toContain("t.DueDate <=");
    expect(params).toEqual(["2026-11-09", "2026-11-09"]);
  });

  it("combines mine and overdue", () => {
    const { text, params } = buildTaskConditions({ mine: true, currentUserId: 4, overdue: true }).compile();
    expect(text).toContain("t.AssigneeId =");
    expect(text).toContain("DueDate < CAST(SYSUTCDATETIME() AS DATE)");
    expect(params).toEqual([4]);
  });
});
