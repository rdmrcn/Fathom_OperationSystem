import type { DashboardStats, TaskPriority, TaskStatus } from "@stratum/shared";
import { TASK_PRIORITIES, TASK_STATUSES } from "@stratum/shared";
import type { AppContext } from "../../context.js";
import type { QueryRunner } from "../../db/pool.js";
import { sql } from "../../db/sql.js";
import { toCount, toNumberOrNull } from "../../lib/mappers.js";
import { tasksRepo } from "../tasks/repo.js";
import { toUserSummary } from "../users/repo.js";

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

export function weekStarts(count: number, now = new Date()): Date[] {
  const current = startOfIsoWeek(now);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(current);
    d.setUTCDate(current.getUTCDate() - (count - 1 - i) * 7);
    return d;
  });
}

export async function getDashboardStats(ctx: AppContext, db: QueryRunner = ctx.db): Promise<DashboardStats> {
  const weeks = weekStarts(8);
  const rangeStart = weeks[0];

  const [totals, byStatus, byPriority, created, completed, workload, progress, overdue, recentActivity] = await Promise.all([
    db.one<Record<string, number>>(sql`
      SELECT (SELECT COUNT(*) FROM dbo.Projects) AS projects,
             (SELECT COUNT(*) FROM dbo.Projects WHERE Status = 'active') AS activeProjects,
             (SELECT COUNT(*) FROM dbo.Tasks) AS tasks,
             (SELECT COUNT(*) FROM dbo.Tasks WHERE Status <> 'done') AS openTasks,
             (SELECT COUNT(*) FROM dbo.Tasks WHERE Status <> 'done' AND DueDate < CAST(SYSUTCDATETIME() AS DATE)) AS overdue,
             (SELECT COUNT(*) FROM dbo.Tasks WHERE CompletedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS completedLast7Days,
             (SELECT COUNT(*) FROM dbo.Tasks WHERE CreatedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS createdLast7Days,
             (SELECT COUNT(*) FROM dbo.Users WHERE IsActive = 1) AS members`),
    db.query<{ status: TaskStatus; count: number }>(sql`SELECT Status AS status, COUNT(*) AS count FROM dbo.Tasks GROUP BY Status`),
    db.query<{ priority: TaskPriority; count: number }>(sql`
      SELECT Priority AS priority, COUNT(*) AS count FROM dbo.Tasks WHERE Status <> 'done' GROUP BY Priority`),
    // Each parameter gets its own name, so the bucket expression is computed once via CROSS APPLY to satisfy GROUP BY.
    db.query<{ bucket: number; count: number }>(sql`
      SELECT b.bucket, COUNT(*) AS count
      FROM dbo.Tasks t CROSS APPLY (SELECT DATEDIFF(DAY, ${rangeStart}, t.CreatedAt) / 7 AS bucket) b
      WHERE t.CreatedAt >= ${rangeStart} GROUP BY b.bucket`),
    db.query<{ bucket: number; count: number }>(sql`
      SELECT b.bucket, COUNT(*) AS count
      FROM dbo.Tasks t CROSS APPLY (SELECT DATEDIFF(DAY, ${rangeStart}, t.CompletedAt) / 7 AS bucket) b
      WHERE t.CompletedAt >= ${rangeStart} GROUP BY b.bucket`),
    db.query<{ id: number; name: string; email: string; avatarColor: string; open: number; overdue: number; estimateHours: number | string | null }>(sql`
      SELECT u.Id AS id, u.Name AS name, u.Email AS email, u.AvatarColor AS avatarColor,
             COUNT(t.Id) AS [open],
             SUM(CASE WHEN t.DueDate < CAST(SYSUTCDATETIME() AS DATE) THEN 1 ELSE 0 END) AS overdue,
             SUM(ISNULL(t.EstimateHours, 0)) AS estimateHours
      FROM dbo.Users u
      JOIN dbo.Tasks t ON t.AssigneeId = u.Id AND t.Status <> 'done'
      WHERE u.IsActive = 1
      GROUP BY u.Id, u.Name, u.Email, u.AvatarColor
      ORDER BY [open] DESC, u.Name`),
    db.query<{ id: number; key: string; name: string; color: string; total: number; done: number; overdue: number }>(sql`
      SELECT p.Id AS id, p.[Key] AS [key], p.Name AS name, p.Color AS color,
             COUNT(t.Id) AS total, SUM(CASE WHEN t.Status = 'done' THEN 1 ELSE 0 END) AS done,
             SUM(CASE WHEN t.Status <> 'done' AND t.DueDate IS NOT NULL AND t.DueDate < CAST(SYSUTCDATETIME() AS DATE) THEN 1 ELSE 0 END) AS overdue
      FROM dbo.Projects p LEFT JOIN dbo.Tasks t ON t.ProjectId = p.Id
      WHERE p.Status IN ('active', 'on_hold')
      GROUP BY p.Id, p.[Key], p.Name, p.Color
      ORDER BY p.Name`),
    tasksRepo.list(db, { overdue: true, sort: "due", page: 1, pageSize: 8 }),
    ctx.activity.recent(db, 10),
  ]);

  const byBucket = (rows: { bucket: number; count: number }[]) =>
    new Map(rows.map((r) => [toCount(r.bucket), toCount(r.count)]));
  const createdMap = byBucket(created);
  const completedMap = byBucket(completed);

  return {
    totals: {
      projects: toCount(totals?.projects),
      activeProjects: toCount(totals?.activeProjects),
      tasks: toCount(totals?.tasks),
      openTasks: toCount(totals?.openTasks),
      overdue: toCount(totals?.overdue),
      completedLast7Days: toCount(totals?.completedLast7Days),
      createdLast7Days: toCount(totals?.createdLast7Days),
      members: toCount(totals?.members),
    },
    byStatus: TASK_STATUSES.map((status) => ({ status, count: toCount(byStatus.find((r) => r.status === status)?.count) })),
    byPriority: TASK_PRIORITIES.map((priority) => ({ priority, count: toCount(byPriority.find((r) => r.priority === priority)?.count) })),
    throughput: weeks.map((weekStart, i) => ({
      weekStart: weekStart.toISOString().slice(0, 10),
      created: createdMap.get(i) ?? 0,
      completed: completedMap.get(i) ?? 0,
    })),
    workload: workload.map((w) => ({
      user: toUserSummary(w)!,
      open: toCount(w.open),
      overdue: toCount(w.overdue),
      estimateHours: toNumberOrNull(w.estimateHours) ?? 0,
    })),
    projectProgress: progress.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      color: p.color,
      total: toCount(p.total),
      done: toCount(p.done),
      overdue: toCount(p.overdue),
    })),
    overdueTasks: overdue.items,
    recentActivity,
  };
}
