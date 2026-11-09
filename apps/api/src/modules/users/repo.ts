import type { Role, User, UserSummary } from "@stratum/shared";
import type { QueryRunner } from "../../db/pool.js";
import { sql } from "../../db/sql.js";
import { toIso } from "../../lib/mappers.js";

export interface UserRow {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  avatarColor: string;
  isActive: boolean;
  createdAt: Date;
}

const userColumns = sql`u.Id AS id, u.Email AS email, u.PasswordHash AS passwordHash, u.Name AS name, u.Role AS role,
  u.JobTitle AS jobTitle, u.AvatarColor AS avatarColor, u.IsActive AS isActive, u.CreatedAt AS createdAt`;

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    jobTitle: row.jobTitle,
    avatarColor: row.avatarColor,
    isActive: Boolean(row.isActive),
    createdAt: toIso(row.createdAt),
  };
}

export function toUserSummary(row: { id: number | null; name: string | null; email: string | null; avatarColor: string | null }): UserSummary | null {
  if (row.id === null || row.id === undefined) return null;
  return { id: row.id, name: row.name ?? "", email: row.email ?? "", avatarColor: row.avatarColor ?? "#6366f1" };
}

export const usersRepo = {
  findByEmail(db: QueryRunner, email: string) {
    return db.one<UserRow>(sql`SELECT ${userColumns} FROM dbo.Users u WHERE u.Email = ${email}`);
  },
  findById(db: QueryRunner, id: number) {
    return db.one<UserRow>(sql`SELECT ${userColumns} FROM dbo.Users u WHERE u.Id = ${id}`);
  },
  list(db: QueryRunner) {
    return db.query<UserRow>(sql`SELECT ${userColumns} FROM dbo.Users u ORDER BY u.Name`);
  },
  count(db: QueryRunner) {
    return db.scalar<number>(sql`SELECT COUNT(*) FROM dbo.Users`);
  },
  async create(db: QueryRunner, input: { email: string; passwordHash: string; name: string; role: Role; jobTitle: string | null; avatarColor: string }) {
    const row = await db.one<{ id: number }>(sql`
      INSERT INTO dbo.Users (Email, PasswordHash, Name, Role, JobTitle, AvatarColor)
      OUTPUT inserted.Id AS id
      VALUES (${input.email}, ${input.passwordHash}, ${input.name}, ${input.role}, ${input.jobTitle}, ${input.avatarColor})`);
    return row!.id;
  },
  updateProfile(db: QueryRunner, id: number, input: { name?: string; jobTitle?: string | null; avatarColor?: string }) {
    return db.execute(sql`
      UPDATE dbo.Users SET
        Name = COALESCE(${input.name ?? null}, Name),
        JobTitle = CASE WHEN ${input.jobTitle === undefined ? 0 : 1} = 1 THEN ${input.jobTitle ?? null} ELSE JobTitle END,
        AvatarColor = COALESCE(${input.avatarColor ?? null}, AvatarColor),
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = ${id}`);
  },
  updateRole(db: QueryRunner, id: number, role: Role) {
    return db.execute(sql`UPDATE dbo.Users SET Role = ${role}, UpdatedAt = SYSUTCDATETIME() WHERE Id = ${id}`);
  },
  setActive(db: QueryRunner, id: number, isActive: boolean) {
    return db.execute(sql`UPDATE dbo.Users SET IsActive = ${isActive}, UpdatedAt = SYSUTCDATETIME() WHERE Id = ${id}`);
  },
  countAdmins(db: QueryRunner) {
    return db.scalar<number>(sql`SELECT COUNT(*) FROM dbo.Users WHERE Role = 'admin' AND IsActive = 1`);
  },
};

export const AVATAR_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#22c55e"];

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
