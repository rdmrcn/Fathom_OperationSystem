import { Router } from "express";
import {
  createCommentSchema,
  createTaskSchema,
  hasRole,
  moveTaskSchema,
  parseTaskKey,
  taskFilterSchema,
  updateTaskSchema,
  type Task,
  type UpdateTaskInput,
} from "@stratum/shared";
import type { AppContext } from "../../context.js";
import type { QueryRunner } from "../../db/pool.js";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { asyncHandler, paramString, parseBody, parseId, parseQuery } from "../../lib/http.js";
import { currentUser } from "../../middleware/auth.js";
import { projectsRepo } from "../projects/repo.js";
import { tasksRepo } from "./repo.js";

/** Computes which fields actually changed so the activity feed stays meaningful. */
export function diffTask(before: Task, input: UpdateTaskInput): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(input) as [keyof UpdateTaskInput, unknown][]) {
    if (value === undefined) continue;
    const previous = before[key as keyof Task];
    const same = Array.isArray(value) ? JSON.stringify(value) === JSON.stringify(previous) : (previous ?? null) === (value ?? null);
    if (!same) changes[key] = { from: previous ?? null, to: value ?? null };
  }
  return changes;
}

export async function createTaskWithActivity(
  ctx: AppContext,
  tx: QueryRunner,
  input: ReturnType<typeof createTaskSchema.parse>,
  actorId: number,
  extraDetails: Record<string, unknown> = {},
): Promise<Task> {
  const number = await projectsRepo.nextTaskNumber(tx, input.projectId);
  if (!number) throw notFound("Project");
  const id = await tasksRepo.create(tx, { ...input, number, reporterId: actorId });
  await ctx.activity.record(tx, {
    actorId,
    projectId: input.projectId,
    taskId: id,
    action: "task.created",
    details: { title: input.title, status: input.status, ...extraDetails },
  });
  if (input.assigneeId) {
    await ctx.activity.record(tx, { actorId, projectId: input.projectId, taskId: id, action: "task.assigned", details: { assigneeId: input.assigneeId } });
  }
  const task = await tasksRepo.findById(tx, id);
  return task!;
}

export function tasksRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const filter = parseQuery(taskFilterSchema, req.query);
      res.json(await tasksRepo.list(ctx.db, { ...filter, currentUserId: user.id }));
    }),
  );

  router.get(
    "/board/:projectId",
    asyncHandler(async (req, res) => {
      const projectId = parseId(req.params.projectId, "projectId");
      if (!(await projectsRepo.findById(ctx.db, projectId))) throw notFound("Project");
      res.json(await tasksRepo.board(ctx.db, projectId));
    }),
  );

  router.get(
    "/by-key/:key",
    asyncHandler(async (req, res) => {
      const parsed = parseTaskKey(paramString(req.params.key));
      if (!parsed) throw badRequest("Invalid task key");
      const task = await tasksRepo.findByKey(ctx.db, parsed.projectKey, parsed.number);
      if (!task) throw notFound("Task");
      res.json(task);
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const input = parseBody(createTaskSchema, req.body);
      const task = await ctx.db.transaction((tx) => createTaskWithActivity(ctx, tx, input, user.id));
      res.status(201).json(task);
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const task = await tasksRepo.findById(ctx.db, parseId(req.params.id));
      if (!task) throw notFound("Task");
      res.json(task);
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const id = parseId(req.params.id);
      const before = await tasksRepo.findById(ctx.db, id);
      if (!before) throw notFound("Task");
      const input = parseBody(updateTaskSchema, req.body);
      const changes = diffTask(before, input);
      const updated = await ctx.db.transaction(async (tx) => {
        await tasksRepo.update(tx, id, input);
        if (Object.keys(changes).length > 0) {
          const action = changes.status?.to === "done" ? "task.completed" : changes.status ? "task.moved" : "task.updated";
          await ctx.activity.record(tx, { actorId: user.id, projectId: before.projectId, taskId: id, action, details: { changes } });
          if (changes.assigneeId) {
            await ctx.activity.record(tx, { actorId: user.id, projectId: before.projectId, taskId: id, action: "task.assigned", details: { assigneeId: changes.assigneeId.to } });
          }
        }
        return tasksRepo.findById(tx, id);
      });
      res.json(updated);
    }),
  );

  router.post(
    "/:id/move",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const id = parseId(req.params.id);
      const before = await tasksRepo.findById(ctx.db, id);
      if (!before) throw notFound("Task");
      const input = parseBody(moveTaskSchema, req.body);
      if (!input.orderedIds.includes(id)) throw badRequest("orderedIds must include the moved task");
      const updated = await ctx.db.transaction(async (tx) => {
        await tasksRepo.reorder(tx, id, input.status, input.orderedIds);
        if (before.status !== input.status) {
          await ctx.activity.record(tx, {
            actorId: user.id,
            projectId: before.projectId,
            taskId: id,
            action: input.status === "done" ? "task.completed" : "task.moved",
            details: { from: before.status, to: input.status },
          });
        }
        return tasksRepo.findById(tx, id);
      });
      res.json(updated);
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const id = parseId(req.params.id);
      const task = await tasksRepo.findById(ctx.db, id);
      if (!task) throw notFound("Task");
      if (!hasRole(user.role, "manager") && task.reporterId !== user.id) throw forbidden("Only managers or the reporter can delete a task");
      await ctx.db.transaction(async (tx) => {
        await ctx.activity.record(tx, { actorId: user.id, projectId: task.projectId, taskId: null, action: "task.deleted", details: { key: task.key, title: task.title } });
        await tasksRepo.remove(tx, id);
      });
      res.status(204).end();
    }),
  );

  router.get(
    "/:id/comments",
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!(await tasksRepo.findById(ctx.db, id))) throw notFound("Task");
      res.json(await tasksRepo.comments(ctx.db, id));
    }),
  );

  router.post(
    "/:id/comments",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const id = parseId(req.params.id);
      const task = await tasksRepo.findById(ctx.db, id);
      if (!task) throw notFound("Task");
      const { body } = parseBody(createCommentSchema, req.body);
      await ctx.db.transaction(async (tx) => {
        await tasksRepo.addComment(tx, id, user.id, body);
        await ctx.activity.record(tx, { actorId: user.id, projectId: task.projectId, taskId: id, action: "comment.added", details: { preview: body.slice(0, 80) } });
      });
      res.status(201).json(await tasksRepo.comments(ctx.db, id));
    }),
  );

  return router;
}
