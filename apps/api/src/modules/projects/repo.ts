import type { CreateProjectInput, Project, ProjectMember, ProjectStatus, Role, UpdateProjectInput } from "@stratum/shared";
import type { QueryRunner } from "../../db/pool.js";
import { join, sql } from "../../db/sql.js";
import { toDateOnly, toIso } from "../../lib/mappers.js";
import { toUserSummary } from "../users/repo.js";

interface ProjectRow {
  id: number;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  leadId: number | null;
  leadName: string | null;
  leadEmail: string | null;
  leadColor: string | null;
  startDate: Date | null;
  targetDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  memberCount: number;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    status: row.status,
    color: row.color,
    leadId: row.leadId,
    lead: toUserSummary({ id: row.leadId, name: row.leadName, email: row.leadEmail, avatarColor: row.leadColor }),
    startDate: toDateOnly(row.startDate),
    targetDate: toDateOnly(row.targetDate),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    taskCount: row.taskCount,
    doneCount: row.doneCount,
    overdueCount: row.overdueCount,
    memberCount: row.memberCount,
  };
}

const projectSelect = sql`
  SELECT p.Id AS id, p.[Key] AS [key], p.Name AS name, p.Description AS description, p.Status AS status, p.Color AS color,
         p.LeadId AS leadId, l.Name AS leadName, l.Email AS leadEmail, l.AvatarColor AS leadColor,
         p.StartDate AS startDate, p.TargetDate AS targetDate, p.CreatedAt AS createdAt, p.UpdatedAt AS updatedAt,
         ISNULL(s.TaskCount, 0) AS taskCount, ISNULL(s.DoneCount, 0) AS doneCount, ISNULL(s.OverdueCount, 0) AS overdueCount,
         (SELECT COUNT(*) FROM dbo.ProjectMembers m WHERE m.ProjectId = p.Id) AS memberCount
  FROM dbo.Projects p
  LEFT JOIN dbo.Users l ON l.Id = p.LeadId
  OUTER APPLY (
    SELECT COUNT(*) AS TaskCount,
           SUM(CASE WHEN t.Status = 'done' THEN 1 ELSE 0 END) AS DoneCount,
           SUM(CASE WHEN t.Status <> 'done' AND t.DueDate < CAST(SYSUTCDATETIME() AS DATE) THEN 1 ELSE 0 END) AS OverdueCount
    FROM dbo.Tasks t WHERE t.ProjectId = p.Id
  ) s`;

export const projectsRepo = {
  async list(db: QueryRunner, filter: { status?: ProjectStatus; memberId?: number } = {}): Promise<Project[]> {
    const conditions = [sql`1 = 1`];
    if (filter.status) conditions.push(sql`p.Status = ${filter.status}`);
    if (filter.memberId) {
      conditions.push(sql`EXISTS (SELECT 1 FROM dbo.ProjectMembers pm WHERE pm.ProjectId = p.Id AND pm.UserId = ${filter.memberId})`);
    }
    const rows = await db.query<ProjectRow>(sql`${projectSelect}
      WHERE ${join(conditions, " AND ")}
      ORDER BY CASE p.Status WHEN 'active' THEN 0 WHEN 'on_hold' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, p.Name`);
    return rows.map(toProject);
  },

  async findById(db: QueryRunner, id: number): Promise<Project | null> {
    const row = await db.one<ProjectRow>(sql`${projectSelect} WHERE p.Id = ${id}`);
    return row ? toProject(row) : null;
  },

  async findByKey(db: QueryRunner, key: string): Promise<Project | null> {
    const row = await db.one<ProjectRow>(sql`${projectSelect} WHERE p.[Key] = ${key}`);
    return row ? toProject(row) : null;
  },

  async create(db: QueryRunner, input: CreateProjectInput): Promise<number> {
    const row = await db.one<{ id: number }>(sql`
      INSERT INTO dbo.Projects ([Key], Name, Description, Status, Color, LeadId, StartDate, TargetDate)
      OUTPUT inserted.Id AS id
      VALUES (${input.key}, ${input.name}, ${input.description ?? null}, ${input.status}, ${input.color},
              ${input.leadId ?? null}, ${input.startDate ?? null}, ${input.targetDate ?? null})`);
    return row!.id;
  },

  async update(db: QueryRunner, id: number, input: UpdateProjectInput): Promise<number> {
    const has = (k: keyof UpdateProjectInput) => (input[k] === undefined ? 0 : 1);
    return db.execute(sql`
      UPDATE dbo.Projects SET
        Name = CASE WHEN ${has("name")} = 1 THEN ${input.name ?? null} ELSE Name END,
        Description = CASE WHEN ${has("description")} = 1 THEN ${input.description ?? null} ELSE Description END,
        Status = CASE WHEN ${has("status")} = 1 THEN ${input.status ?? null} ELSE Status END,
        Color = CASE WHEN ${has("color")} = 1 THEN ${input.color ?? null} ELSE Color END,
        LeadId = CASE WHEN ${has("leadId")} = 1 THEN ${input.leadId ?? null} ELSE LeadId END,
        StartDate = CASE WHEN ${has("startDate")} = 1 THEN ${input.startDate ?? null} ELSE StartDate END,
        TargetDate = CASE WHEN ${has("targetDate")} = 1 THEN ${input.targetDate ?? null} ELSE TargetDate END,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = ${id}`);
  },

  remove(db: QueryRunner, id: number): Promise<number> {
    return db.execute(sql`DELETE FROM dbo.Projects WHERE Id = ${id}`);
  },

  async members(db: QueryRunner, projectId: number): Promise<ProjectMember[]> {
    const rows = await db.query<{ id: number; name: string; email: string; avatarColor: string; role: Role; jobTitle: string | null; joinedAt: Date }>(sql`
      SELECT u.Id AS id, u.Name AS name, u.Email AS email, u.AvatarColor AS avatarColor, u.Role AS role, u.JobTitle AS jobTitle, pm.JoinedAt AS joinedAt
      FROM dbo.ProjectMembers pm JOIN dbo.Users u ON u.Id = pm.UserId
      WHERE pm.ProjectId = ${projectId} ORDER BY u.Name`);
    return rows.map((r) => ({ ...r, joinedAt: toIso(r.joinedAt) }));
  },

  addMember(db: QueryRunner, projectId: number, userId: number): Promise<number> {
    return db.execute(sql`
      IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE ProjectId = ${projectId} AND UserId = ${userId})
        INSERT INTO dbo.ProjectMembers (ProjectId, UserId) VALUES (${projectId}, ${userId})`);
  },

  removeMember(db: QueryRunner, projectId: number, userId: number): Promise<number> {
    return db.execute(sql`DELETE FROM dbo.ProjectMembers WHERE ProjectId = ${projectId} AND UserId = ${userId}`);
  },

  isMember(db: QueryRunner, projectId: number, userId: number): Promise<number | null> {
    return db.scalar<number>(sql`SELECT COUNT(*) FROM dbo.ProjectMembers WHERE ProjectId = ${projectId} AND UserId = ${userId}`);
  },

  /** Atomically allocates the next per-project task number. */
  async nextTaskNumber(db: QueryRunner, projectId: number): Promise<number | null> {
    const row = await db.one<{ number: number }>(sql`
      UPDATE dbo.Projects SET NextTaskNumber = NextTaskNumber + 1
      OUTPUT deleted.NextTaskNumber AS number
      WHERE Id = ${projectId}`);
    return row?.number ?? null;
  },
};
