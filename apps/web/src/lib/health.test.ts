import { describe, expect, it } from "vitest";
import { projectHealth } from "./health";

describe("projectHealth", () => {
  it("treats empty projects as healthy", () => {
    expect(projectHealth({ total: 0, done: 0, overdue: 0 })).toEqual({ score: 100, label: "healthy" });
  });

  it("scores completed work without overdue as healthy", () => {
    const result = projectHealth({ total: 10, done: 8, overdue: 0 });
    expect(result.label).toBe("healthy");
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("flags a high overdue ratio as at risk", () => {
    expect(projectHealth({ total: 10, done: 1, overdue: 4 }).label).toBe("at_risk");
  });
});
