export const ROLES = ["admin", "manager", "member"] as const;
export type Role = (typeof ROLES)[number];

export const PROJECT_STATUSES = ["active", "on_hold", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ["feature", "bug", "chore", "research"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const ACTIVITY_ACTIONS = [
  "project.created",
  "project.updated",
  "project.member_added",
  "project.member_removed",
  "task.created",
  "task.updated",
  "task.moved",
  "task.assigned",
  "task.completed",
  "task.deleted",
  "comment.added",
  "user.role_changed",
  "ai.tasks_generated",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  feature: "Feature",
  bug: "Bug",
  chore: "Chore",
  research: "Research",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/** Role hierarchy used for permission checks (higher number = more rights). */
export const ROLE_RANK: Record<Role, number> = { member: 1, manager: 2, admin: 3 };

export function hasRole(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}
