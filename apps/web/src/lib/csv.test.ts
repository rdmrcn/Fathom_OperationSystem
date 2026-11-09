import type { Task } from "@stratum/shared";
import { describe, expect, it } from "vitest";
import { tasksToCsv, tasksToJson } from "./csv";

function stub(partial: Pick<Task, "id" | "key" | "title">): Task {
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
    labels: ["webhooks"],
    commentCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...partial,
  };
}

describe("tasksToCsv", () => {
  it("quotes titles that contain commas", () => {
    const csv = tasksToCsv([stub({ id: 7, key: "PAY-7", title: "Webhook, retried" })]);
    expect(csv.split("\n")[0]).toContain("key,title,project");
    expect(csv).toContain("PAY-7");
    expect(csv).toContain('"Webhook, retried"');
  });

  it("emits JSON rows with the task key", () => {
    const json = tasksToJson([stub({ id: 7, key: "PAY-7", title: "Webhook, retried" })]);
    const rows = JSON.parse(json) as { key: string; title: string }[];
    expect(rows[0]).toMatchObject({ key: "PAY-7", title: "Webhook, retried", project: "PAY" });
  });
});
