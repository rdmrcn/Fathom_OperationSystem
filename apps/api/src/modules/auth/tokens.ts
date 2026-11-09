import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@stratum/shared";

export interface AccessTokenClaims {
  sub: string;
  role: Role;
  name: string;
  email: string;
}

export interface TokenConfig {
  secret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
}

export function signAccessToken(claims: AccessTokenClaims, config: TokenConfig): string {
  const { sub, ...rest } = claims;
  return jwt.sign(rest, config.secret, {
    subject: sub,
    expiresIn: config.accessTtlSeconds,
    issuer: "fathom-api",
    audience: "fathom-web",
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string, config: TokenConfig): AccessTokenClaims | null {
  try {
    const payload = jwt.verify(token, config.secret, {
      issuer: "fathom-api",
      audience: "fathom-web",
      algorithms: ["HS256"],
    });
    if (typeof payload !== "object" || payload === null || typeof payload.sub !== "string") return null;
    const { role, name, email } = payload as jwt.JwtPayload & Partial<AccessTokenClaims>;
    if (!role || !name || !email) return null;
    return { sub: payload.sub, role, name, email };
  } catch {
    return null;
  }
}

/** Opaque refresh token; only its SHA-256 hash is stored. */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiry(config: TokenConfig, now = new Date()): Date {
  return new Date(now.getTime() + config.refreshTtlDays * 24 * 60 * 60 * 1000);
}
