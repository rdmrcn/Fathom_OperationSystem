import bcrypt from "bcryptjs";
import type { AuthResponse, LoginInput, RegisterInput, User } from "@stratum/shared";
import type { Env } from "../../config/env.js";
import type { Database } from "../../db/pool.js";
import { sql } from "../../db/sql.js";
import { conflict, HttpError, unauthorized } from "../../lib/errors.js";
import { pickAvatarColor, toUser, usersRepo } from "../users/repo.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  signAccessToken,
  type TokenConfig,
} from "./tokens.js";

export function tokenConfigFromEnv(env: Env): TokenConfig {
  return { secret: env.JWT_SECRET, accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS, refreshTtlDays: env.JWT_REFRESH_TTL_DAYS };
}

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly tokens: TokenConfig,
  ) {}

  async register(input: RegisterInput, userAgent: string | null): Promise<AuthResponse> {
    const existing = await usersRepo.findByEmail(this.db, input.email);
    if (existing) throw conflict("An account with this email already exists", "email_taken");
    const passwordHash = await bcrypt.hash(input.password, 10);
    // The very first account becomes the administrator so a fresh install is usable.
    const total = (await usersRepo.count(this.db)) ?? 0;
    const id = await usersRepo.create(this.db, {
      email: input.email,
      passwordHash,
      name: input.name,
      role: total === 0 ? "admin" : "member",
      jobTitle: input.jobTitle?.trim() || null,
      avatarColor: pickAvatarColor(input.email),
    });
    const row = await usersRepo.findById(this.db, id);
    return this.issue(toUser(row!), userAgent);
  }

  async login(input: LoginInput, userAgent: string | null): Promise<AuthResponse> {
    const row = await usersRepo.findByEmail(this.db, input.email);
    // Compare against a dummy hash when the user is unknown to keep timing uniform.
    const hash = row?.passwordHash ?? "$2a$10$CwTycUXWue0Thq9StjUM0uJ8gq5oYz1oG1Z5d2bqvZVwXz1X2Xg6W";
    const ok = await bcrypt.compare(input.password, hash);
    if (!row || !ok) throw unauthorized("Incorrect email or password");
    if (!row.isActive) throw new HttpError(403, "account_disabled", "This account has been deactivated");
    return this.issue(toUser(row), userAgent);
  }

  /** Rotates the refresh token. Reusing an already-rotated token revokes the whole family. */
  async refresh(refreshToken: string, userAgent: string | null): Promise<AuthResponse> {
    const hash = hashRefreshToken(refreshToken);
    const stored = await this.db.one<{ id: number; userId: number; expiresAt: Date; revokedAt: Date | null }>(sql`
      SELECT Id AS id, UserId AS userId, ExpiresAt AS expiresAt, RevokedAt AS revokedAt
      FROM dbo.RefreshTokens WHERE TokenHash = ${hash}`);
    if (!stored) throw unauthorized("Invalid refresh token");
    if (stored.revokedAt) {
      await this.revokeAll(stored.userId);
      throw unauthorized("Refresh token reuse detected; please sign in again");
    }
    if (stored.expiresAt.getTime() < Date.now()) throw unauthorized("Refresh token expired");

    const row = await usersRepo.findById(this.db, stored.userId);
    if (!row || !row.isActive) throw unauthorized("Account unavailable");

    const next = generateRefreshToken();
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME(), ReplacedByTokenHash = ${next.hash} WHERE Id = ${stored.id}`);
      await tx.execute(sql`
        INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt, UserAgent)
        VALUES (${stored.userId}, ${next.hash}, ${refreshExpiry(this.tokens)}, ${userAgent})`);
    });
    const user = toUser(row);
    return { user, ...this.accessFor(user), refreshToken: next.token };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.db.execute(sql`
      UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME()
      WHERE TokenHash = ${hashRefreshToken(refreshToken)} AND RevokedAt IS NULL`);
  }

  async revokeAll(userId: number): Promise<void> {
    await this.db.execute(sql`
      UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME() WHERE UserId = ${userId} AND RevokedAt IS NULL`);
  }

  private accessFor(user: User): { accessToken: string; expiresIn: number } {
    return {
      accessToken: signAccessToken({ sub: String(user.id), role: user.role, name: user.name, email: user.email }, this.tokens),
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }

  private async issue(user: User, userAgent: string | null): Promise<AuthResponse> {
    const refresh = generateRefreshToken();
    await this.db.execute(sql`
      INSERT INTO dbo.RefreshTokens (UserId, TokenHash, ExpiresAt, UserAgent)
      VALUES (${user.id}, ${refresh.hash}, ${refreshExpiry(this.tokens)}, ${userAgent?.slice(0, 300) ?? null})`);
    return { user, ...this.accessFor(user), refreshToken: refresh.token };
  }
}
