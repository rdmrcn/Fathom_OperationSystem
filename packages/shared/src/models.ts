import type { ActivityAction, ProjectStatus, Role, TaskPriority, TaskStatus, TaskType } from "./enums.js";

/** ISO-8601 timestamps as produced by the API. */
export type IsoDate = string;

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  avatarColor: string;
  isActive: boolean;
  createdAt: IsoDate;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  avatarColor: string;
}

export interface Project {
  id: number;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  leadId: number | null;
  lead: UserSummary | null;
  startDate: string | null;
  targetDate: string | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  memberCount: number;
}

export interface ProjectMember extends UserSummary {
  role: Role;
  jobTitle: string | null;
  joinedAt: IsoDate;
}

export interface Task {
  id: number;
  projectId: number;
  projectKey: string;
  projectName: string;
  number: number;
  /** Human-readable key such as `PAY-42`. */
  key: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assigneeId: number | null;
  assignee: UserSummary | null;
  reporterId: number;
  reporter: UserSummary | null;
  dueDate: string | null;
  estimateHours: number | null;
  position: number;
  labels: string[];
  commentCount: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  completedAt: IsoDate | null;
}

export interface Comment {
  id: number;
  taskId: number;
  authorId: number;
  author: UserSummary | null;
  body: string;
  createdAt: IsoDate;
}

export interface Activity {
  id: number;
  actorId: number | null;
  actor: UserSummary | null;
  projectId: number | null;
  projectKey: string | null;
  taskId: number | null;
  taskKey: string | null;
  taskTitle: string | null;
  action: ActivityAction;
  details: Record<string, unknown>;
  createdAt: IsoDate;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
