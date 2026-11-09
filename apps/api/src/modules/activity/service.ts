import type { Activity, ActivityAction, Paginated } from "@stratum/shared";
import type { QueryRunner } from "../../db/pool.js";
import { join, sql } from "../../db/sql.js";
import { parseJsonObject, toIso } from "../../lib/mappers.js";
import { toUserSummary } from "../users/repo.js";

interface ActivityRow {
  id: number | bigint | string;
  actorId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  actorColor: string | null;
  projectId: number | null;
  projectKey: string | null;
  taskId: number | null;
  taskNumber: number | null;
  taskTitle: string | null;
  action: ActivityAction;
  details: string;
  createdAt: Date;
}

function toActivity(row: ActivityRow): Activity {
  const details = parseJsonObject(row.details);
  const detailsKey = typeof details.key === "string" ? details.key : null;
  const detailsTitle = typeof details.title === "string" ? details.title : null;
  return {
    id: Number(row.id),
    actorId: row.actorId,
    actor: toUserSummary({ id: row.actorId, name: row.actorName, email: row.actorEmail, avatarColor: row.actorColor }),
    projectId: row.projectId,
    projectKey: row.projectKey,
    taskId: row.taskId,
    taskKey: row.projectKey && row.taskNumber ? `${row.projectKey}-${row.taskNumber}` : detailsKey,
    taskTitle: row.taskTitle ?? detailsTitle,
    action: row.action,
    details,
    createdAt: toIso(row.createdAt),
  };
}

const activitySelect = sql`
  SELECT al.Id AS id, al.ActorId AS actorId, u.Name AS actorName, u.Email AS actorEmail, u.AvatarColor AS actorColor,
         al.ProjectId AS projectId, p.[Key] AS projectKey, al.TaskId AS taskId, t.Number AS taskNumber, t.Title AS taskTitle,
         al.Action AS action, al.Details AS details, al.CreatedAt AS createdAt
  FROM dbo.ActivityLog al
  LEFT JOIN dbo.Users u ON u.Id = al.ActorId
  LEFT JOIN dbo.Projects p ON p.Id = al.ProjectId
  LEFT JOIN dbo.Tasks t ON t.Id = al.TaskId`;

export class ActivityService {
  async record(
    db: QueryRunner,
    entry: { actorId: number | null; projectId?: number | null; taskId?: number | null; action: ActivityAction; details?: Record<string, unknown> },
  ): Promise<void> {
    await db.execute(sql`
      INSERT INTO dbo.ActivityLog (ActorId, ProjectId, TaskId, Action, Details)
      VALUES (${entry.actorId}, ${entry.projectId ?? null}, ${entry.taskId ?? null}, ${entry.action}, ${JSON.stringify(entry.details ?? {})})`);
  }

  async list(
    db: QueryRunner,
    filter: { projectId?: number; taskId?: number; page: number; pageSize: number },
  ): Promise<Paginated<Activity>> {
    const conditions = [sql`1 = 1`];
    if (filter.projectId) conditions.push(sql`al.ProjectId = ${filter.projectId}`);
    if (filter.taskId) conditions.push(sql`al.TaskId = ${filter.taskId}`);
    const where = join(conditions, " AND ");
    const offset = (filter.page - 1) * filter.pageSize;
    const [rows, total] = await Promise.all([
      db.query<ActivityRow>(sql`${activitySelect} WHERE ${where}
        ORDER BY al.CreatedAt DESC, al.Id DESC OFFSET ${offset} ROWS FETCH NEXT ${filter.pageSize} ROWS ONLY`),
      db.scalar<number>(sql`SELECT COUNT(*) FROM dbo.ActivityLog al WHERE ${where}`),
    ]);
    return { items: rows.map(toActivity), total: total ?? 0, page: filter.page, pageSize: filter.pageSize };
  }

  async recent(db: QueryRunner, limit: number): Promise<Activity[]> {
    const rows = await db.query<ActivityRow>(sql`${activitySelect} ORDER BY al.CreatedAt DESC, al.Id DESC OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`);
    return rows.map(toActivity);
  }
}
