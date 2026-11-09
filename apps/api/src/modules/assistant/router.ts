import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { applyBreakdownSchema, breakdownRequestSchema, chatRequestSchema, createTaskSchema, type AssistantCapabilities } from "@stratum/shared";
import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/errors.js";
import { asyncHandler, parseBody, parseId } from "../../lib/http.js";
import { currentUser } from "../../middleware/auth.js";
import { projectsRepo } from "../projects/repo.js";
import { createTaskWithActivity } from "../tasks/router.js";
import { generateBreakdown } from "./breakdown.js";
import { SUGGESTED_PROMPTS } from "./builtin.js";
import { conversationsRepo } from "./conversations.js";
import { chat } from "./orchestrator.js";
import { summarizeProject } from "./summary.js";
import { assistantTools } from "./tools.js";

export function assistantRouter(ctx: AppContext): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: ctx.env.NODE_ENV === "test" ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? "")),
    message: { error: { code: "rate_limited", message: "The assistant is receiving too many requests; try again in a minute" } },
  });

  router.get("/capabilities", (_req, res) => {
    const body: AssistantCapabilities = {
      llmEnabled: ctx.llm !== null,
      model: ctx.llm?.model ?? null,
      tools: assistantTools.map((t) => ({ name: t.name, description: t.description })),
      suggestedPrompts: SUGGESTED_PROMPTS,
    };
    res.json(body);
  });

  router.get(
    "/conversations",
    asyncHandler(async (req, res) => {
      res.json(await conversationsRepo.list(ctx.db, currentUser(req).id));
    }),
  );

  router.get(
    "/conversations/:id",
    asyncHandler(async (req, res) => {
      const detail = await conversationsRepo.detail(ctx.db, currentUser(req).id, parseId(req.params.id));
      if (!detail) throw notFound("Conversation");
      res.json(detail);
    }),
  );

  router.delete(
    "/conversations/:id",
    asyncHandler(async (req, res) => {
      const removed = await conversationsRepo.remove(ctx.db, currentUser(req).id, parseId(req.params.id));
      if (!removed) throw notFound("Conversation");
      res.status(204).end();
    }),
  );

  router.post(
    "/chat",
    limiter,
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const input = parseBody(chatRequestSchema, req.body);
      res.json(await chat(ctx, user, input));
    }),
  );

  router.post(
    "/breakdown",
    limiter,
    asyncHandler(async (req, res) => {
      const input = parseBody(breakdownRequestSchema, req.body);
      const project = await projectsRepo.findById(ctx.db, input.projectId);
      if (!project) throw notFound("Project");
      res.json(await generateBreakdown(ctx.llm, project, input.goal, input.maxTasks));
    }),
  );

  router.post(
    "/breakdown/apply",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const input = parseBody(applyBreakdownSchema, req.body);
      const project = await projectsRepo.findById(ctx.db, input.projectId);
      if (!project) throw notFound("Project");
      const created = await ctx.db.transaction(async (tx) => {
        const tasks = [];
        for (const t of input.tasks) {
          const taskInput = createTaskSchema.parse({
            projectId: input.projectId,
            title: t.title,
            description: t.description || null,
            status: "backlog",
            priority: t.priority,
            type: t.type,
            estimateHours: t.estimateHours ?? null,
            labels: t.labels,
          });
          tasks.push(await createTaskWithActivity(ctx, tx, taskInput, user.id, { via: "ai_breakdown" }));
        }
        await ctx.activity.record(tx, { actorId: user.id, projectId: input.projectId, action: "ai.tasks_generated", details: { count: tasks.length, keys: tasks.map((t) => t.key) } });
        return tasks;
      });
      res.status(201).json(created);
    }),
  );

  router.get(
    "/projects/:id/summary",
    limiter,
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const project = await projectsRepo.findById(ctx.db, parseId(req.params.id));
      if (!project) throw notFound("Project");
      res.json(await summarizeProject(ctx.llm, project, { app: ctx, user, page: { projectId: project.id } }));
    }),
  );

  return router;
}
