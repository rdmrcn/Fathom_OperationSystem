import type { ProjectStatus, TaskPriority, TaskStatus, TaskType } from "@stratum/shared";
import { PROJECT_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from "@stratum/shared";
import { Badge } from "@/components/ui/primitives";
import { PRIORITY_TONE, PROJECT_TONE, STATUS_TONE, TYPE_TONE } from "@/lib/labels";
import { dueLabel } from "@/lib/utils";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{TASK_PRIORITY_LABELS[priority]}</Badge>;
}
export function TypeBadge({ type }: { type: TaskType }) {
  return <Badge tone={TYPE_TONE[type]}>{TASK_TYPE_LABELS[type]}</Badge>;
}
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={PROJECT_TONE[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}
export function DueBadge({ dueDate, done }: { dueDate: string | null; done: boolean }) {
  const d = dueLabel(dueDate, done);
  if (d.tone === "none" && !dueDate) return null;
  const tone = d.tone === "overdue" ? "danger" : d.tone === "soon" ? "warning" : "neutral";
  return <Badge tone={tone}>{d.text}</Badge>;
}
