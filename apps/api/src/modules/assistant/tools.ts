import type { AssistantToolTrace, Task, TaskPriority, TaskStatus, TaskType } from "@stratum/shared";
import { createTaskSchema, TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@stratum/shared";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { raw, sql } from "../../db/sql.js";
import type { AuthUser } from "../../middleware/auth.js";
import { getDashboardStats } from "../dashboard/service.js";
import { projectsRepo } from "../projects/repo.js";
import { tasksRepo } from "../tasks/repo.js";
import { createTaskWithActivity } from "../tasks/router.js";
import { usersRepo } from "../users/repo.js";
import { guardReportQuery, MAX_REPORT_ROWS } from "./sql-guard.js";

export interface ToolContext {
  app: AppContext;
  user: AuthUser;
  page?: { projectId?: number; taskId?: number };
}

export interface ToolResult {
  /** Compact JSON-serialisable data handed to the model / formatter. */
  data: unknown;
  trace: AssistantToolTrace;
}

export interface AssistantTool<TArgs = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<TArgs>;
  /** JSON schema for the LLM function definition. */
  parameters: Record<string, unknown>;
  /** Tools that change data; the model is told to call them only on an explicit request. */
  mutating?: boolean;
  run(args: TArgs, ctx: ToolContext): Promise<ToolResult>;
}

/** Trimmed task representation that keeps model prompts small. */
export function compactTask(t: Task) {
  return {
    key: t.key,
    title: t.title,
    project: t.projectKey,
    status: t.status,
    priority: t.priority,
    type: t.type,
    assignee: t.assignee?.name ?? null,
    dueDate: t.dueDate,
    estimateHours: t.estimateHours,
    labels: t.labels,
    overdue: Boolean(t.dueDate && t.status !== "done" && t.dueDate < new Date().toISOString().slice(0, 10)),
    updatedAt: t.updatedAt,
  };
}

export type CompactTask = ReturnType<typeof compactTask>;

async function resolveUserId(ctx: ToolContext, name: string | undefined): Promise<number | null | "ambiguous"> {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  if (["me", "myself", "i"].includes(needle)) return ctx.user.id;
  const users = await usersRepo.list(ctx.app.db);
  const exact = users.filter((u) => u.name.toLowerCase() === needle || u.email.toLowerCase() === needle);
  if (exact.length === 1) return exact[0].id;
  const partial = users.filter((u) => u.name.toLowerCase().includes(needle) || needle.includes(u.name.toLowerCase().split(" ")[0]));
  if (partial.length === 1) return partial[0].id;
  return partial.length > 1 ? "ambiguous" : null;
}

async function resolveProjectId(ctx: ToolContext, keyOrName: string | undefined): Promise<number | null> {
  if (!keyOrName) return ctx.page?.projectId ?? null;
  const needle = keyOrName.trim().toLowerCase();
  const projects = await projectsRepo.list(ctx.app.db);
  const match =
    projects.find((p) => p.key.toLowerCase() === needle) ??
    projects.find((p) => p.name.toLowerCase() === needle) ??
    projects.find((p) => p.name.toLowerCase().includes(needle));
  return match?.id ?? null;
}

const searchTasksSchema = z.object({
  query: z.string().max(100).optional(),
  project: z.string().max(100).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  assignee: z.string().max(80).optional(),
  overdueOnly: z.boolean().optional(),
  openOnly: z.boolean().optional(),
  dueWithinDays: z.number().int().min(0).max(365).optional(),
  sort: z.enum(["updated", "created", "due", "priority"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const searchTasksTool: AssistantTool<z.infer<typeof searchTasksSchema>> = {
  name: "search_tasks",
  description:
    "Find tasks. Filter by free-text query, project key/name, status, priority, type, assignee name ('me' for the current user), overdue only, or due within N days. Returns up to 50 compact tasks.",
  schema: searchTasksSchema,
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Words to match in title/description/labels, or a task key like PAY-7" },
      project: { type: "string", description: "Project key (PAY) or name" },
      status: { type: "string", enum: [...TASK_STATUSES] },
      priority: { type: "string", enum: [...TASK_PRIORITIES] },
      type: { type: "string", enum: [...TASK_TYPES] },
      assignee: { type: "string", description: "Assignee name, or 'me'" },
      overdueOnly: { type: "boolean" },
      openOnly: { type: "boolean", description: "Exclude done tasks" },
      dueWithinDays: { type: "integer", description: "Only open tasks due within this many days" },
      sort: { type: "string", enum: ["updated", "created", "due", "priority"] },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
  },
  async run(args, ctx) {
    const started = Date.now();
    const projectId = args.project ? await resolveProjectId(ctx, args.project) : ctx.page?.projectId;
    if (args.project && !projectId) {
      return { data: { error: `No project matches "${args.project}"` }, trace: { tool: "search_tasks", summary: `Unknown project ${args.project}`, resultCount: 0 } };
    }
    const assigneeId = await resolveUserId(ctx, args.assignee);
    if (assigneeId === "ambiguous") {
      return { data: { error: `Several people match "${args.assignee}"; ask for the full name` }, trace: { tool: "search_tasks", summary: "Ambiguous assignee", resultCount: 0 } };
    }
    if (args.assignee && assigneeId === null) {
      return { data: { error: `Nobody named "${args.assignee}" found` }, trace: { tool: "search_tasks", summary: "Unknown assignee", resultCount: 0 } };
    }
    const limit = args.limit ?? 20;
    const result = await tasksRepo.list(ctx.app.db, {
      q: args.query,
      projectId: projectId ?? undefined,
      status: args.status,
      priority: args.priority,
      type: args.type,
      assigneeId: assigneeId ?? undefined,
      overdue: args.overdueOnly,
      open: args.openOnly || args.dueWithinDays !== undefined,
      sort: args.sort ?? (args.overdueOnly || args.dueWithinDays !== undefined ? "due" : "priority"),
      page: 1,
      pageSize: args.dueWithinDays !== undefined ? 200 : limit,
    });
    let items = result.items;
    if (args.dueWithinDays !== undefined) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() + args.dueWithinDays);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      items = items.filter((t) => t.status !== "done" && t.dueDate && t.dueDate <= cutoffStr).slice(0, limit);
    }
    const parts = [
      args.query && `"${args.query}"`,
      args.project && `project ${args.project}`,
      args.status && `status ${args.status}`,
      args.priority && `priority ${args.priority}`,
      args.assignee && `assignee ${args.assignee}`,
      args.overdueOnly && "overdue",
      args.openOnly && "open",
      args.dueWithinDays !== undefined && `due within ${args.dueWithinDays}d`,
    ].filter(Boolean);
    return {
      data: { total: args.dueWithinDays !== undefined ? items.length : result.total, tasks: items.map(compactTask) },
      trace: { tool: "search_tasks", summary: parts.length ? `Tasks matching ${parts.join(", ")}` : "All tasks", resultCount: items.length, durationMs: Date.now() - started },
    };
  },
};

const getTaskSchema = z.object({ key: z.string().min(3).max(20) });

export const getTaskTool: AssistantTool<z.infer<typeof getTaskSchema>> = {
  name: "get_task",
  description: "Get full details of one task by its key (e.g. PAY-7), including description and recent comments.",
  schema: getTaskSchema,
  parameters: { type: "object", properties: { key: { type: "string", description: "Task key such as PAY-7" } }, required: ["key"] },
  async run(args, ctx) {
    const started = Date.now();
    const match = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/.exec(args.key.trim());
    const task = match ? await tasksRepo.findByKey(ctx.app.db, match[1].toUpperCase(), Number(match[2])) : null;
    if (!task) return { data: { error: `Task ${args.key} not found` }, trace: { tool: "get_task", summary: `Task ${args.key} not found`, resultCount: 0 } };
    const comments = await tasksRepo.comments(ctx.app.db, task.id);
    return {
      data: {
        ...compactTask(task),
        description: task.description,
        reporter: task.reporter?.name ?? null,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        comments: comments.slice(-5).map((c) => ({ author: c.author?.name ?? "Unknown", body: c.body, at: c.createdAt })),
      },
      trace: { tool: "get_task", summary: `Loaded ${task.key}`, resultCount: 1, durationMs: Date.now() - started },
    };
  },
};

export const listProjectsTool: AssistantTool<Record<string, never>> = {
  name: "list_projects",
  description: "List all projects with status, lead, dates and task/overdue counts.",
  schema: z.object({}).strict() as unknown as z.ZodType<Record<string, never>>,
  parameters: { type: "object", properties: {} },
  async run(_args, ctx) {
    const started = Date.now();
    const projects = await projectsRepo.list(ctx.app.db);
    return {
      data: projects.map((p) => ({
        key: p.key,
        name: p.name,
        status: p.status,
        lead: p.lead?.name ?? null,
        startDate: p.startDate,
        targetDate: p.targetDate,
        tasks: p.taskCount,
        done: p.doneCount,
        overdue: p.overdueCount,
        members: p.memberCount,
      })),
      trace: { tool: "list_projects", summary: "All projects with progress", resultCount: projects.length, durationMs: Date.now() - started },
    };
  },
};

const projectSummarySchema = z.object({ project: z.string().max(100).optional() });

export const projectSummaryTool: AssistantTool<z.infer<typeof projectSummarySchema>> = {
  name: "get_project_summary",
  description:
    "Detailed health snapshot of one project: counts by status and priority, overdue and due-soon tasks, blocked critical items, members and workload. Defaults to the project currently open in the UI.",
  schema: projectSummarySchema,
  parameters: { type: "object", properties: { project: { type: "string", description: "Project key or name" } } },
  async run(args, ctx) {
    const started = Date.now();
    const projectId = await resolveProjectId(ctx, args.project);
    const project = projectId ? await projectsRepo.findById(ctx.app.db, projectId) : null;
    if (!project) return { data: { error: args.project ? `No project matches "${args.project}"` : "No project specified" }, trace: { tool: "get_project_summary", summary: "Project not found", resultCount: 0 } };
    const [tasks, members] = await Promise.all([tasksRepo.board(ctx.app.db, project.id), projectsRepo.members(ctx.app.db, project.id)]);
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 7);
    const soonStr = soon.toISOString().slice(0, 10);
    const open = tasks.filter((t) => t.status !== "done");
    const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length])) as Record<TaskStatus, number>;
    const byPriority = Object.fromEntries(TASK_PRIORITIES.map((p) => [p, open.filter((t) => t.priority === p).length])) as Record<TaskPriority, number>;
    const byType = Object.fromEntries(TASK_TYPES.map((p) => [p, open.filter((t) => t.type === p).length])) as Record<TaskType, number>;
    const workload = members.map((m) => ({ name: m.name, open: open.filter((t) => t.assigneeId === m.id).length, overdue: open.filter((t) => t.assigneeId === m.id && t.dueDate && t.dueDate < today).length }));
    const estimateOpen = open.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0);
    return {
      data: {
        key: project.key,
        name: project.name,
        status: project.status,
        description: project.description,
        lead: project.lead?.name ?? null,
        startDate: project.startDate,
        targetDate: project.targetDate,
        daysToTarget: project.targetDate ? Math.round((Date.parse(project.targetDate) - Date.parse(today)) / 86_400_000) : null,
        totals: { tasks: tasks.length, done: byStatus.done, open: open.length, percentDone: tasks.length ? Math.round((byStatus.done / tasks.length) * 100) : 0, openEstimateHours: estimateOpen },
        byStatus,
        byPriority,
        byType,
        overdue: open.filter((t) => t.dueDate && t.dueDate < today).map(compactTask),
        dueSoon: open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= soonStr).map(compactTask),
        critical: open.filter((t) => t.priority === "critical").map(compactTask),
        unassigned: open.filter((t) => !t.assigneeId).length,
        inReview: tasks.filter((t) => t.status === "in_review").map(compactTask),
        workload,
        recentlyCompleted: tasks
          .filter((t) => t.status === "done")
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
          .slice(0, 5)
          .map(compactTask),
      },
      trace: { tool: "get_project_summary", summary: `Health snapshot of ${project.key} (${tasks.length} tasks)`, resultCount: tasks.length, durationMs: Date.now() - started },
    };
  },
};

export const workloadTool: AssistantTool<Record<string, never>> = {
  name: "get_team_workload",
  description: "Open and overdue task counts plus estimated hours per team member, and the overall dashboard totals and weekly throughput.",
  schema: z.object({}).strict() as unknown as z.ZodType<Record<string, never>>,
  parameters: { type: "object", properties: {} },
  async run(_args, ctx) {
    const started = Date.now();
    const stats = await getDashboardStats(ctx.app);
    const users = await usersRepo.list(ctx.app.db);
    const idle = users.filter((u) => u.isActive && !stats.workload.some((w) => w.user.id === u.id)).map((u) => u.name);
    return {
      data: {
        totals: stats.totals,
        workload: stats.workload.map((w) => ({ name: w.user.name, open: w.open, overdue: w.overdue, estimateHours: w.estimateHours })),
        noOpenTasks: idle,
        throughput: stats.throughput,
        byStatus: stats.byStatus,
        byPriority: stats.byPriority,
      },
      trace: { tool: "get_team_workload", summary: "Team workload and dashboard totals", resultCount: stats.workload.length, durationMs: Date.now() - started },
    };
  },
};

const reportQuerySchema = z.object({ sql: z.string().min(10).max(4000), purpose: z.string().max(200).optional() });

export const reportQueryTool: AssistantTool<z.infer<typeof reportQuerySchema>> = {
  name: "run_report_query",
  description:
    "Run a read-only T-SQL SELECT against the reporting views (reporting.vTasks, vProjects, vUsers, vActivity, vComments) for questions the other tools cannot answer, such as aggregations, averages, trends or cycle times. Max 50 rows. Never use it for data the other tools return directly.",
  schema: reportQuerySchema,
  parameters: {
    type: "object",
    properties: {
      sql: { type: "string", description: "A single T-SQL SELECT statement over reporting.* views" },
      purpose: { type: "string", description: "One sentence on what the query answers" },
    },
    required: ["sql"],
  },
  async run(args, ctx) {
    const started = Date.now();
    const guard = guardReportQuery(args.sql);
    if (!guard.ok || !guard.sql) {
      return { data: { error: `Query rejected: ${guard.reason}` }, trace: { tool: "run_report_query", summary: `Rejected: ${guard.reason}`, resultCount: 0 } };
    }
    try {
      const rows = await ctx.app.reportingDb.query<Record<string, unknown>>(
        sql`SET ROWCOUNT ${raw(String(MAX_REPORT_ROWS))}; ${raw(guard.sql)}; SET ROWCOUNT 0;`,
      );
      return {
        data: { rowCount: rows.length, truncated: rows.length >= MAX_REPORT_ROWS, rows },
        trace: { tool: "run_report_query", summary: guard.sql.replace(/\s+/g, " ").slice(0, 300), resultCount: rows.length, durationMs: Date.now() - started },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Query failed";
      return { data: { error: `SQL Server error: ${message.slice(0, 300)}` }, trace: { tool: "run_report_query", summary: `Failed: ${guard.sql.slice(0, 120)}`, resultCount: 0, durationMs: Date.now() - started } };
    }
  },
};

const createTaskToolSchema = z.object({
  project: z.string().max(100).optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  assignee: z.string().max(80).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estimateHours: z.number().min(0).max(1000).optional(),
  labels: z.array(z.string().max(30)).max(10).optional(),
});

export const createTaskTool: AssistantTool<z.infer<typeof createTaskToolSchema>> = {
  name: "create_task",
  description:
    "Create a new task in a project. ONLY call this when the user explicitly asks to create/add a task. Ask for the project if it is unclear. Returns the created task key.",
  schema: createTaskToolSchema,
  mutating: true,
  parameters: {
    type: "object",
    properties: {
      project: { type: "string", description: "Project key or name; defaults to the project open in the UI" },
      title: { type: "string" },
      description: { type: "string" },
      priority: { type: "string", enum: [...TASK_PRIORITIES] },
      type: { type: "string", enum: [...TASK_TYPES] },
      assignee: { type: "string", description: "Assignee name or 'me'" },
      dueDate: { type: "string", description: "YYYY-MM-DD" },
      estimateHours: { type: "number" },
      labels: { type: "array", items: { type: "string" } },
    },
    required: ["title"],
  },
  async run(args, ctx) {
    const started = Date.now();
    const projectId = await resolveProjectId(ctx, args.project);
    if (!projectId) {
      return { data: { error: args.project ? `No project matches "${args.project}"` : "No project specified" }, trace: { tool: "create_task", summary: "Project not found", resultCount: 0 } };
    }
    const assigneeId = await resolveUserId(ctx, args.assignee);
    if (assigneeId === "ambiguous") return { data: { error: `Several people match "${args.assignee}"` }, trace: { tool: "create_task", summary: "Ambiguous assignee", resultCount: 0 } };
    const input = createTaskSchema.parse({
      projectId,
      title: args.title,
      description: args.description ?? null,
      status: "todo",
      priority: args.priority ?? "medium",
      type: args.type ?? "feature",
      assigneeId: typeof assigneeId === "number" ? assigneeId : null,
      dueDate: args.dueDate ?? null,
      estimateHours: args.estimateHours ?? null,
      labels: args.labels ?? [],
    });
    const task = await ctx.app.db.transaction((tx) => createTaskWithActivity(ctx.app, tx, input, ctx.user.id, { via: "assistant" }));
    return {
      data: { created: true, task: compactTask(task), url: `/projects/${task.projectId}?task=${task.id}` },
      trace: { tool: "create_task", summary: `Created ${task.key}: ${task.title}`, resultCount: 1, durationMs: Date.now() - started },
    };
  },
};

export const assistantTools: AssistantTool<never>[] = [
  searchTasksTool,
  getTaskTool,
  listProjectsTool,
  projectSummaryTool,
  workloadTool,
  reportQueryTool,
  createTaskTool,
] as AssistantTool<never>[];

export function findTool(name: string): AssistantTool<never> | undefined {
  return assistantTools.find((t) => t.name === name);
}

/** Validates arguments with the tool's zod schema and runs it; never throws. */
export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const tool = findTool(name);
  if (!tool) return { data: { error: `Unknown tool ${name}` }, trace: { tool: name, summary: "Unknown tool", resultCount: 0 } };
  const parsed = (tool.schema as z.ZodType<unknown>).safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { data: { error: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` }, trace: { tool: name, summary: "Invalid arguments", resultCount: 0 } };
  }
  try {
    return await tool.run(parsed.data as never, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool failed";
    return { data: { error: message.slice(0, 300) }, trace: { tool: name, summary: `Failed: ${message.slice(0, 120)}`, resultCount: 0 } };
  }
}
