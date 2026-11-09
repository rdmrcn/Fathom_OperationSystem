import type { ActivityAction, ProjectStatus, Role, TaskPriority, TaskStatus, TaskType } from "@stratum/shared";
import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "@stratum/shared";
type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  backlog: "neutral",
  todo: "info",
  in_progress: "accent",
  in_review: "warning",
  done: "success",
};

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export const TYPE_TONE: Record<TaskType, Tone> = {
  feature: "accent",
  bug: "danger",
  chore: "neutral",
  research: "info",
};

export const PROJECT_TONE: Record<ProjectStatus, Tone> = {
  active: "success",
  on_hold: "warning",
  completed: "info",
  archived: "neutral",
};

export const ROLE_TONE: Record<Role, Tone> = {
  admin: "danger",
  manager: "accent",
  member: "neutral",
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  backlog: "#64748b",
  todo: "#0ea5e9",
  in_progress: "#818cf8",
  in_review: "#f59e0b",
  done: "#34d399",
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "#94a3b8",
  medium: "#38bdf8",
  high: "#f59e0b",
  critical: "#f43f5e",
};

export const STATUS_OPTIONS = (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
}));
export const PRIORITY_OPTIONS = (Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
  value,
  label: TASK_PRIORITY_LABELS[value],
}));
export const TYPE_OPTIONS = (Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((value) => ({
  value,
  label: TASK_TYPE_LABELS[value],
}));
export const PROJECT_STATUS_OPTIONS = (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((value) => ({
  value,
  label: PROJECT_STATUS_LABELS[value],
}));
export const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Member" },
];

export const COLUMN_ORDER: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];

export const ACTIVITY_COPY: Record<ActivityAction, string> = {
  "project.created": "created the project",
  "project.updated": "updated the project",
  "project.member_added": "added a member",
  "project.member_removed": "removed a member",
  "task.created": "created a task",
  "task.updated": "updated a task",
  "task.moved": "moved a task",
  "task.assigned": "assigned a task",
  "task.completed": "completed a task",
  "task.deleted": "deleted a task",
  "comment.added": "commented",
  "user.role_changed": "changed a role",
  "ai.tasks_generated": "generated tasks with AI",
};

export { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS, PROJECT_STATUS_LABELS };
