import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { AppContext } from "./context.js";
import { sql } from "./db/sql.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { resolveWebDist } from "./lib/web-dist.js";
import { requireAuth } from "./middleware/auth.js";
import { activityRouter } from "./modules/activity/router.js";
import { assistantRouter } from "./modules/assistant/router.js";
import { authRouter } from "./modules/auth/router.js";
import { dashboardRouter } from "./modules/dashboard/router.js";
import { projectsRouter } from "./modules/projects/router.js";
import { tasksRouter } from "./modules/tasks/router.js";
import { usersRouter } from "./modules/users/router.js";

export function createApp(ctx: AppContext): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // Local demo is HTTP; HSTS and HTTPS-upgrade would break it in the browser.
      strictTransportSecurity: ctx.env.NODE_ENV === "production",
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: ctx.env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: false,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  if (ctx.env.NODE_ENV !== "test") {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  }

  app.get("/api/health", async (_req, res) => {
    try {
      const version = await ctx.db.scalar<string>(sql`SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50))`);
      res.json({ status: "ok", database: "connected", sqlServerVersion: version, llm: ctx.llm ? ctx.llm.model : "builtin" });
    } catch {
      res.status(503).json({ status: "degraded", database: "unreachable" });
    }
  });

  const auth = requireAuth(ctx.tokens);
  app.use("/api/auth", authRouter(ctx));
  app.use("/api/users", auth, usersRouter(ctx));
  app.use("/api/projects", auth, projectsRouter(ctx));
  app.use("/api/tasks", auth, tasksRouter(ctx));
  app.use("/api/activity", auth, activityRouter(ctx));
  app.use("/api/dashboard", auth, dashboardRouter(ctx));
  app.use("/api/assistant", auth, assistantRouter(ctx));

  const webDist = resolveWebDist();
  if (webDist) {
    logger.info({ webDist }, "Serving the React app from this process");
    app.use(express.static(webDist, { index: false, maxAge: "1h" }));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
