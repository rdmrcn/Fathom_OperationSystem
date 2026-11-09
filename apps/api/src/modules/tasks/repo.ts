import type {
  Comment,
  CreateTaskInput,
  Paginated,
  Task,
  TaskFilter,
  TaskPriority,
  TaskStatus,
  TaskType,
  UpdateTaskInput,
} from "@stratum/shared";
import type { QueryRunner } from "../../db/pool.js";
import { join, raw, sql, type SqlFragment } from "../../db/sql.js";
import { parseJsonArray, toDateOnly, toIso, toIsoOrNull, toNumberOrNull } from "../../lib/mappers.js";
import { toUserSummary } from "../users/repo.js";

interface TaskRow {
  id: number;
  projectId: number;
  projectKey: string;
  projectName: string;
  number: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assigneeId: number | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeColor: string | null;
  reporterId: number;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterColor: string | null;
  dueDate: Date | null;
  estimateHours: number | string | null;
  position: number;
  labels: string;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    projectKey: row.projectKey,
    projectName: row.projectName,
    number: row.number,
    key: `${row.projectKey}-${row.number}`,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    type: row.type,
    assigneeId: row.assigneeId,
    assignee: toUserSummary({ id: row.assigneeId, name: row.assigneeName, email: row.assigneeEmail, avatarColor: row.assigneeColor }),
    reporterId: row.reporterId,
    reporter: toUserSummary({ id: row.reporterId, name: row.reporterName, email: row.reporterEmail, avatarColor: row.reporterColor }),
    dueDate: toDateOnly(row.dueDate),
    estimateHours: toNumberOrNull(row.estimateHours),
    position: row.position,
    labels: parseJsonArray(row.labels),
    commentCount: row.commentCount ?? 0,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    completedAt: toIsoOrNull(row.completedAt),
  };
}

export const taskSelect = sql`
  SELECT t.Id AS id, t.ProjectId AS projectId, p.[Key] AS projectKey, p.Name AS projectName, t.Number AS number,
         t.Title AS title, t.Description AS description, t.Status AS status, t.Priority AS priority, t.Type AS type,
         t.AssigneeId AS assigneeId, a.Name AS assigneeName, a.Email AS assigneeEmail, a.AvatarColor AS assigneeColor,
         t.ReporterId AS reporterId, r.Name AS reporterName, r.Email AS reporterEmail, r.AvatarColor AS reporterColor,
         t.DueDate AS dueDate, t.EstimateHours AS estimateHours, t.Position AS position, t.Labels AS labels,
         (SELECT COUNT(*) FROM dbo.Comments c WHERE c.TaskId = t.Id) AS commentCount,
         t.CreatedAt AS createdAt, t.UpdatedAt AS updatedAt, t.CompletedAt AS completedAt
  FROM dbo.Tasks t
  JOIN dbo.Projects p ON p.Id = t.ProjectId
  LEFT JOIN dbo.Users a ON a.Id = t.AssigneeId
  LEFT JOIN dbo.Users r ON r.Id = t.ReporterId`;

const sortClauses: Record<TaskFilter["sort"], string> = {
  updated: "t.UpdatedAt DESC",
  created: "t.CreatedAt DESC",
  due: "CASE WHEN t.DueDate IS NULL THEN 1 ELSE 0 END, t.DueDate ASC, t.Priority DESC",
  priority:
    "CASE t.Priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, CASE WHEN t.DueDate IS NULL THEN 1 ELSE 0 END, t.DueDate ASC",
};

export type TaskListFilter = Partial<TaskFilter> & { currentUserId?: number; open?: boolean };

export function buildTaskConditions(filter: TaskListFilter): SqlFragment {
  const conditions = [sql`1 = 1`];
  if (filter.projectId) conditions.push(sql`t.ProjectId = ${filter.projectId}`);
  if (filter.open) conditions.push(sql`t.Status <> 'done'`);
  if (filter.assigneeId) conditions.push(sql`t.AssigneeId = ${filter.assigneeId}`);
  if (filter.mine && filter.currentUserId) conditions.push(sql`t.AssigneeId = ${filter.currentUserId}`);
  if (filter.status) conditions.push(sql`t.Status = ${filter.status}`);
  if (filter.priority) conditions.push(sql`t.Priority = ${filter.priority}`);
  if (filter.type) conditions.push(sql`t.Type = ${filter.type}`);
  if (filter.overdue) conditions.push(sql`t.Status <> 'done' AND t.DueDate < CAST(SYSUTCDATETIME() AS DATE)`);
  if (filter.dueFrom) conditions.push(sql`t.DueDate >= ${filter.dueFrom}`);
  if (filter.dueTo) conditions.push(sql`t.DueDate <= ${filter.dueTo}`);
  if (filter.q) {
    const like = `%${filter.q.replace(/[%_[]/g, (m) => `[${m}]`)}%`;
    const keyMatch = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/.exec(filter.q.trim());
    if (keyMatch) {
      conditions.push(sql`((p.[Key] = ${keyMatch[1].toUpperCase()} AND t.Number = ${Number(keyMatch[2])}) OR t.Title LIKE ${like})`);
    } else {
      conditions.push(sql`(t.Title LIKE ${like} OR t.Description LIKE ${like} OR t.Labels LIKE ${like})`);
    }
  }
  return join(conditions, " AND ");
}

export const tasksRepo = {
  async list(db: QueryRunner, filter: TaskListFilter & Pick<TaskFilter, "sort" | "page" | "pageSize">): Promise<Paginated<Task>> {
    const where = buildTaskConditions(filter);
    const offset = (filter.page - 1) * filter.pageSize;
    const [rows, total] = await Promise.all([
      db.query<TaskRow>(sql`${taskSelect} WHERE ${where}
        ORDER BY ${raw(sortClauses[filter.sort])}, t.Id DESC
        OFFSET ${offset} ROWS FETCH NEXT ${filter.pageSize} ROWS ONLY`),
      db.scalar<number>(sql`SELECT COUNT(*) FROM dbo.Tasks t JOIN dbo.Projects p ON p.Id = t.ProjectId WHERE ${where}`),
    ]);
    return { items: rows.map(toTask), total: total ?? 0, page: filter.page, pageSize: filter.pageSize };
  },

  /** All tasks of a project ordered for the Kanban board. */
  async board(db: QueryRunner, projectId: number): Promise<Task[]> {
    const rows = await db.query<TaskRow>(sql`${taskSelect} WHERE t.ProjectId = ${projectId} ORDER BY t.Status, t.Position, t.Id`);
    return rows.map(toTask);
  },

  async findById(db: QueryRunner, id: number): Promise<Task | null> {
    const row = await db.one<TaskRow>(sql`${taskSelect} WHERE t.Id = ${id}`);
    return row ? toTask(row) : null;
  },

  async findByKey(db: QueryRunner, projectKey: string, number: number): Promise<Task | null> {
    const row = await db.one<TaskRow>(sql`${taskSelect} WHERE p.[Key] = ${projectKey} AND t.Number = ${number}`);
    return row ? toTask(row) : null;
  },

  async create(db: QueryRunner, input: CreateTaskInput & { number: number; reporterId: number }): Promise<number> {
    const row = await db.one<{ id: number }>(sql`
      INSERT INTO dbo.Tasks (ProjectId, Number, Title, Description, Status, Priority, Type, AssigneeId, ReporterId,
                             DueDate, EstimateHours, Position, Labels, CompletedAt)
      OUTPUT inserted.Id AS id
      SELECT ${input.projectId}, ${input.number}, ${input.title}, ${input.description ?? null}, ${input.status}, ${input.priority},
             ${input.type}, ${input.assigneeId ?? null}, ${input.reporterId}, ${input.dueDate ?? null}, ${input.estimateHours ?? null},
             ISNULL(MAX(Position), 0) + 1000, ${JSON.stringify(input.labels)},
             CASE WHEN ${input.status} = 'done' THEN SYSUTCDATETIME() ELSE NULL END
      FROM dbo.Tasks WHERE ProjectId = ${input.projectId} AND Status = ${input.status}`);
    return row!.id;
  },

  async update(db: QueryRunner, id: number, input: UpdateTaskInput): Promise<number> {
    const has = (k: keyof UpdateTaskInput) => (input[k] === undefined ? 0 : 1);
    return db.execute(sql`
      UPDATE dbo.Tasks SET
        Title = CASE WHEN ${has("title")} = 1 THEN ${input.title ?? null} ELSE Title END,
        Description = CASE WHEN ${has("description")} = 1 THEN ${input.description ?? null} ELSE Description END,
        Priority = CASE WHEN ${has("priority")} = 1 THEN ${input.priority ?? null} ELSE Priority END,
        Type = CASE WHEN ${has("type")} = 1 THEN ${input.type ?? null} ELSE Type END,
        AssigneeId = CASE WHEN ${has("assigneeId")} = 1 THEN ${input.assigneeId ?? null} ELSE AssigneeId END,
        DueDate = CASE WHEN ${has("dueDate")} = 1 THEN ${input.dueDate ?? null} ELSE DueDate END,
        EstimateHours = CASE WHEN ${has("estimateHours")} = 1 THEN ${input.estimateHours ?? null} ELSE EstimateHours END,
        Labels = CASE WHEN ${has("labels")} = 1 THEN ${JSON.stringify(input.labels ?? [])} ELSE Labels END,
        CompletedAt = CASE
          WHEN ${has("status")} = 1 AND ${input.status ?? null} = 'done' AND Status <> 'done' THEN SYSUTCDATETIME()
          WHEN ${has("status")} = 1 AND ${input.status ?? null} <> 'done' THEN NULL
          ELSE CompletedAt END,
        Status = CASE WHEN ${has("status")} = 1 THEN ${input.status ?? null} ELSE Status END,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = ${id}`);
  },

  /** Rewrites positions for a column and moves `taskId` into it. */
  async reorder(db: QueryRunner, taskId: number, status: TaskStatus, orderedIds: number[]): Promise<void> {
    await db.execute(sql`
      UPDATE dbo.Tasks SET
        Status = ${status},
        CompletedAt = CASE WHEN ${status} = 'done' THEN ISNULL(CompletedAt, SYSUTCDATETIME()) ELSE NULL END,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = ${taskId}`);
    if (orderedIds.length === 0) return;
    const values = join(
      orderedIds.map((id, index) => sql`(${id}, ${(index + 1) * 1000})`),
      ", ",
    );
    await db.execute(sql`
      UPDATE t SET t.Position = v.Position
      FROM dbo.Tasks t
      JOIN (VALUES ${values}) AS v(Id, Position) ON v.Id = t.Id
      WHERE t.Status = ${status}`);
  },

  remove(db: QueryRunner, id: number): Promise<number> {
    return db.execute(sql`DELETE FROM dbo.Tasks WHERE Id = ${id}`);
  },

  async comments(db: QueryRunner, taskId: number): Promise<Comment[]> {
    const rows = await db.query<{ id: number; taskId: number; authorId: number; authorName: string | null; authorEmail: string | null; authorColor: string | null; body: string; createdAt: Date }>(sql`
      SELECT c.Id AS id, c.TaskId AS taskId, c.AuthorId AS authorId, u.Name AS authorName, u.Email AS authorEmail, u.AvatarColor AS authorColor,
             c.Body AS body, c.CreatedAt AS createdAt
      FROM dbo.Comments c LEFT JOIN dbo.Users u ON u.Id = c.AuthorId
      WHERE c.TaskId = ${taskId} ORDER BY c.CreatedAt ASC`);
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      authorId: r.authorId,
      author: toUserSummary({ id: r.authorId, name: r.authorName, email: r.authorEmail, avatarColor: r.authorColor }),
      body: r.body,
      createdAt: toIso(r.createdAt),
    }));
  },

  async addComment(db: QueryRunner, taskId: number, authorId: number, body: string): Promise<number> {
    const row = await db.one<{ id: number }>(sql`
      INSERT INTO dbo.Comments (TaskId, AuthorId, Body) OUTPUT inserted.Id AS id VALUES (${taskId}, ${authorId}, ${body})`);
    return row!.id;
  },
};
