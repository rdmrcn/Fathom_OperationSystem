import type { RequestHandler } from "express";
import { hasRole, type Role } from "@stratum/shared";
import { forbidden, unauthorized } from "../lib/errors.js";
import type { TokenConfig } from "../modules/auth/tokens.js";
import { verifyAccessToken } from "../modules/auth/tokens.js";

export interface AuthUser {
  id: number;
  role: Role;
  name: string;
  email: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(tokens: TokenConfig): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return next(unauthorized());
    const claims = verifyAccessToken(token, tokens);
    if (!claims) return next(unauthorized("Session expired or invalid"));
    req.user = { id: Number(claims.sub), role: claims.role, name: claims.name, email: claims.email };
    next();
  };
}

export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!hasRole(req.user.role, role)) return next(forbidden(`This action requires the ${role} role`));
    next();
  };
}

export function currentUser(req: { user?: AuthUser }): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
