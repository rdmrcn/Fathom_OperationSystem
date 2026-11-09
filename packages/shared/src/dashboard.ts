import type { TaskPriority, TaskStatus } from "./enums.js";
import type { Activity, Task, UserSummary } from "./models.js";

export interface DashboardStats {
  totals: {
    projects: number;
    activeProjects: number;
    tasks: number;
    openTasks: number;
    overdue: number;
    completedLast7Days: number;
    createdLast7Days: number;
    members: number;
  };
  byStatus: { status: TaskStatus; count: number }[];
  byPriority: { priority: TaskPriority; count: number }[];
  /** Weekly throughput for the trailing 8 weeks (ISO week start). */
  throughput: { weekStart: string; created: number; completed: number }[];
  workload: { user: UserSummary; open: number; overdue: number; estimateHours: number }[];
  projectProgress: { id: number; key: string; name: string; color: string; total: number; done: number; overdue: number }[];
  overdueTasks: Task[];
  recentActivity: Activity[];
}
