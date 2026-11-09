import bcrypt from "bcryptjs";
import type { Database } from "./pool.js";
import { seedConversation, seedProjects, seedUsers } from "./seed-data.js";
import { sql } from "./sql.js";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(10, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateOnly(days: number): string {
  return daysFromNow(days).toISOString().slice(0, 10);
}

export interface SeedResult {
  users: number;
  projects: number;
  tasks: number;
  comments: number;
}

/**
 * Inserts the demo workspace. Returns null when users already exist so
 * `db:seed` is safe to run repeatedly; use `db:reset` for a clean slate.
 */
export async function seedDatabase(db: Database, options: { demoPassword: string; force?: boolean }): Promise<SeedResult | null> {
  const existing = await db.scalar<number>(sql`SELECT COUNT(*) FROM dbo.Users`);
  if (existing && !options.force) return null;

  const passwordHash = await bcrypt.hash(options.demoPassword, 10);
  const result: SeedResult = { users: 0, projects: 0, tasks: 0, comments: 0 };

  await db.transaction(async (tx) => {
    const userIds: number[] = [];
    for (const [i, u] of seedUsers.entries()) {
      const row = await tx.one<{ id: number }>(sql`
        INSERT INTO dbo.Users (Email, PasswordHash, Name, Role, JobTitle, AvatarColor, CreatedAt, UpdatedAt)
        OUTPUT inserted.Id AS id
        VALUES (${u.email}, ${passwordHash}, ${u.name}, ${u.role}, ${u.jobTitle}, ${u.avatarColor},
                ${daysFromNow(-150 + i)}, ${daysFromNow(-150 + i)})`);
      userIds.push(row!.id);
      result.users++;
    }

    for (const p of seedProjects) {
      const createdAt = daysFromNow(-p.startDaysAgo);
      const project = await tx.one<{ id: number }>(sql`
        INSERT INTO dbo.Projects ([Key], Name, Description, Status, Color, LeadId, StartDate, TargetDate, NextTaskNumber, CreatedAt, UpdatedAt)
        OUTPUT inserted.Id AS id
        VALUES (${p.key}, ${p.name}, ${p.description}, ${p.status}, ${p.color}, ${userIds[p.lead]},
                ${dateOnly(-p.startDaysAgo)}, ${p.targetInDays === null ? null : dateOnly(p.targetInDays)},
                ${p.tasks.length + 1}, ${createdAt}, ${createdAt})`);
      const projectId = project!.id;
      result.projects++;

      for (const memberIndex of new Set([...p.members, p.lead])) {
        await tx.execute(sql`
          INSERT INTO dbo.ProjectMembers (ProjectId, UserId, JoinedAt)
          VALUES (${projectId}, ${userIds[memberIndex]}, ${createdAt})`);
      }
      await tx.execute(sql`
        INSERT INTO dbo.ActivityLog (ActorId, ProjectId, Action, Details, CreatedAt)
        VALUES (${userIds[p.lead]}, ${projectId}, 'project.created', ${JSON.stringify({ name: p.name, key: p.key })}, ${createdAt})`);

      const positions: Record<string, number> = {};
      for (const [i, t] of p.tasks.entries()) {
        const number = i + 1;
        const taskCreated = daysFromNow(-t.createdDaysAgo);
        const completedAt = t.status === "done" ? daysFromNow(-(t.completedDaysAgo ?? 1)) : null;
        const updatedAt = completedAt ?? daysFromNow(-Math.max(0, Math.floor(t.createdDaysAgo / 2)));
        positions[t.status] = (positions[t.status] ?? 0) + 1000;
        const task = await tx.one<{ id: number }>(sql`
          INSERT INTO dbo.Tasks (ProjectId, Number, Title, Description, Status, Priority, Type, AssigneeId, ReporterId,
                                 DueDate, EstimateHours, Position, Labels, CreatedAt, UpdatedAt, CompletedAt)
          OUTPUT inserted.Id AS id
          VALUES (${projectId}, ${number}, ${t.title}, ${t.description ?? null}, ${t.status}, ${t.priority}, ${t.type},
                  ${t.assignee === null ? null : userIds[t.assignee]}, ${userIds[p.lead]},
                  ${t.due === undefined ? null : dateOnly(t.due)}, ${t.estimate ?? null}, ${positions[t.status]},
                  ${JSON.stringify(t.labels ?? [])}, ${taskCreated}, ${updatedAt}, ${completedAt})`);
        const taskId = task!.id;
        result.tasks++;

        await tx.execute(sql`
          INSERT INTO dbo.ActivityLog (ActorId, ProjectId, TaskId, Action, Details, CreatedAt)
          VALUES (${userIds[p.lead]}, ${projectId}, ${taskId}, 'task.created', ${JSON.stringify({ title: t.title })}, ${taskCreated})`);
        if (completedAt && t.assignee !== null) {
          await tx.execute(sql`
            INSERT INTO dbo.ActivityLog (ActorId, ProjectId, TaskId, Action, Details, CreatedAt)
            VALUES (${userIds[t.assignee]}, ${projectId}, ${taskId}, 'task.completed', ${JSON.stringify({ from: "in_review", to: "done" })}, ${completedAt})`);
        }
        for (const c of t.comments ?? []) {
          await tx.execute(sql`
            INSERT INTO dbo.Comments (TaskId, AuthorId, Body, CreatedAt)
            VALUES (${taskId}, ${userIds[c.author]}, ${c.body}, ${daysFromNow(-c.daysAgo)})`);
          await tx.execute(sql`
            INSERT INTO dbo.ActivityLog (ActorId, ProjectId, TaskId, Action, Details, CreatedAt)
            VALUES (${userIds[c.author]}, ${projectId}, ${taskId}, 'comment.added', ${JSON.stringify({ preview: c.body.slice(0, 80) })}, ${daysFromNow(-c.daysAgo)})`);
          result.comments++;
        }
      }
    }

    const conversation = await tx.one<{ id: number }>(sql`
      INSERT INTO dbo.Conversations (UserId, Title, CreatedAt, UpdatedAt)
      OUTPUT inserted.Id AS id
      VALUES (${userIds[0]}, ${seedConversation.title}, ${daysFromNow(-1)}, ${daysFromNow(-1)})`);
    for (const [i, m] of seedConversation.messages.entries()) {
      await tx.execute(sql`
        INSERT INTO dbo.Messages (ConversationId, Role, Content, Source, ToolTrace, CreatedAt)
        VALUES (${conversation!.id}, ${m.role}, ${m.content}, ${m.role === "assistant" ? "builtin" : null},
                ${m.role === "assistant" ? JSON.stringify([{ tool: "list_overdue_tasks", summary: "Open tasks with a due date in the past", resultCount: 3 }]) : "[]"},
                ${new Date(daysFromNow(-1).getTime() + i * 5000)})`);
    }
  });

  return result;
}
