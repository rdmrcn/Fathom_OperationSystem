import { z } from "zod";
import { PROJECT_STATUSES, ROLES, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "./enums.js";

const isoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  email: emailSchema,
  password: passwordSchema,
  jobTitle: z.string().trim().max(80).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(512) });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  jobTitle: z.string().trim().max(80).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changeRoleSchema = z.object({ role: z.enum(ROLES) });

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, "2-6 letters/digits, starting with a letter");

export const createProjectSchema = z.object({
  key: projectKeySchema,
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).default("active"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  leadId: z.number().int().positive().nullable().optional(),
  startDate: isoDateOnly.nullable().optional(),
  targetDate: isoDateOnly.nullable().optional(),
  memberIds: z.array(z.number().int().positive()).max(100).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.omit({ key: true, memberIds: true }).partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addMemberSchema = z.object({ userId: z.number().int().positive() });

export const labelSchema = z.string().trim().min(1).max(30);

export const createTaskSchema = z.object({
  projectId: z.number().int().positive(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(10_000).nullable().optional(),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  type: z.enum(TASK_TYPES).default("feature"),
  assigneeId: z.number().int().positive().nullable().optional(),
  dueDate: isoDateOnly.nullable().optional(),
  estimateHours: z.number().min(0).max(1000).nullable().optional(),
  labels: z.array(labelSchema).max(10).default([]),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.omit({ projectId: true }).partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  /** Ids of the tasks in the destination column, in their new order (including the moved task). */
  orderedIds: z.array(z.number().int().positive()).max(500),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const taskFilterSchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
  overdue: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  mine: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  open: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  dueFrom: isoDateOnly.optional(),
  dueTo: isoDateOnly.optional(),
  sort: z.enum(["updated", "created", "due", "priority"]).default("updated"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export const createCommentSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export const activityFilterSchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  taskId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
