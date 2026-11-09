import type { Task, TaskStatus } from "@stratum/shared";
import { COLUMN_ORDER } from "./labels";

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = Object.fromEntries(COLUMN_ORDER.map((s) => [s, [] as Task[]])) as Record<TaskStatus, Task[]>;
  for (const t of tasks) groups[t.status].push(t);
  for (const s of COLUMN_ORDER) groups[s].sort((a, b) => a.position - b.position || a.id - b.id);
  return groups;
}
