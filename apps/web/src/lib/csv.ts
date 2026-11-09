import type { Task } from "@stratum/shared";

function cell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
  return raw;
}

export function tasksToCsv(tasks: Task[]): string {
  const header = ["key", "title", "project", "status", "priority", "type", "assignee", "due", "labels"];
  const rows = tasks.map((task) =>
    [
      task.key,
      task.title,
      task.projectKey,
      task.status,
      task.priority,
      task.type,
      task.assignee?.name ?? "",
      task.dueDate ?? "",
      task.labels.join(";"),
    ]
      .map(cell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function tasksToJson(tasks: Task[]): string {
  return `${JSON.stringify(
    tasks.map((task) => ({
      key: task.key,
      title: task.title,
      project: task.projectKey,
      status: task.status,
      priority: task.priority,
      type: task.type,
      assignee: task.assignee?.name ?? null,
      due: task.dueDate,
      labels: task.labels,
    })),
    null,
    2,
  )}\n`;
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
