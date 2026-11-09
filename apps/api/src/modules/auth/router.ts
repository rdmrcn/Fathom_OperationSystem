import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginSchema, refreshSchema, registerSchema } from "@stratum/shared";
import type { AppContext } from "../../context.js";
import { asyncHandler, parseBody } from "../../lib/http.js";

export function authRouter(ctx: AppContext): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: ctx.env.NODE_ENV === "test" ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { code: "rate_limited", message: "Too many attempts, please try again later" } },
  });

  const userAgent = (req: { headers: Record<string, unknown> }) =>
    typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string) : null;

  router.post(
    "/register",
    limiter,
    asyncHandler(async (req, res) => {
      const input = parseBody(registerSchema, req.body);
      res.status(201).json(await ctx.auth.register(input, userAgent(req)));
    }),
  );

  router.post(
    "/login",
    limiter,
    asyncHandler(async (req, res) => {
      const input = parseBody(loginSchema, req.body);
      res.json(await ctx.auth.login(input, userAgent(req)));
    }),
  );

  router.post(
    "/refresh",
    asyncHandler(async (req, res) => {
      const { refreshToken } = parseBody(refreshSchema, req.body);
      res.json(await ctx.auth.refresh(refreshToken, userAgent(req)));
    }),
  );

  router.post(
    "/logout",
    asyncHandler(async (req, res) => {
      const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
      await ctx.auth.logout(token);
      res.status(204).end();
    }),
  );

  return router;
}
