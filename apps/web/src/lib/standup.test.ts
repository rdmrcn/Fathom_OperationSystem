import type { Task } from "@stratum/shared";
import { describe, expect, it } from "vitest";
import { standupMarkdown } from "./standup";

function stub(partial: Pick<Task, "id" | "key" | "title"> & Partial<Task>): Task {
  return {
    projectId: 1,
    projectKey: "PAY",
    projectName: "Payments",
    number: partial.id,
    description: null,
    status: "todo",
    priority: "high",
    type: "bug",
    assigneeId: null,
    assignee: null,
    reporterId: 1,
    reporter: null,
    dueDate: "2026-11-09",
    estimateHours: 4,
    position: 1,
    labels: [],
    commentCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...partial,
  };
}

describe("standupMarkdown", () => {
  it("includes overdue keys and empty-section placeholders", () => {
    const md = standupMarkdown({
      date: "2026-11-09",
      name: "Reha Demircan",
      overdue: [stub({ id: 7, key: "PAY-7", title: "Webhook retries" })],
      dueToday: [],
      inProgress: [],
    });
    expect(md).toContain("# Fathom standup — 2026-11-09");
    expect(md).toContain("PAY-7");
    expect(md).toContain("_Nothing due today._");
    expect(md).toContain("_No in-progress work._");
  });
});
