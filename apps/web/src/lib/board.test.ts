import type { Task } from "@stratum/shared";
import { describe, expect, it } from "vitest";
import { groupByStatus } from "./board";

function stub(partial: Pick<Task, "id" | "status" | "position">): Task {
  return {
    projectId: 1,
    projectKey: "PAY",
    projectName: "Payments",
    number: partial.id,
    key: `PAY-${partial.id}`,
    title: "t",
    description: null,
    priority: "medium",
    type: "feature",
    assigneeId: null,
    assignee: null,
    reporterId: 1,
    reporter: null,
    dueDate: null,
    estimateHours: null,
    labels: [],
    commentCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...partial,
  };
}

describe("groupByStatus", () => {
  it("puts every task in its column and sorts by position", () => {
    const grouped = groupByStatus([
      stub({ id: 2, status: "todo", position: 2 }),
      stub({ id: 1, status: "todo", position: 1 }),
      stub({ id: 3, status: "done", position: 1 }),
    ]);
    expect(grouped.backlog).toHaveLength(0);
    expect(grouped.in_progress).toHaveLength(0);
    expect(grouped.in_review).toHaveLength(0);
    expect(grouped.todo.map((t) => t.id)).toEqual([1, 2]);
    expect(grouped.done.map((t) => t.id)).toEqual([3]);
  });
});
