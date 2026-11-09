import { Router } from "express";
import {
  addMemberSchema,
  createProjectSchema,
  hasRole,
  PROJECT_STATUSES,
  updateProjectSchema,
  type Project,
} from "@stratum/shared";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { asyncHandler, parseBody, parseId, parseQuery } from "../../lib/http.js";
import { currentUser, requireRole, type AuthUser } from "../../middleware/auth.js";
import { projectsRepo } from "./repo.js";

const listQuery = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  mine: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

/** Managers and admins may edit any project; the project lead may edit their own. */
export function canManageProject(user: AuthUser, project: Project): boolean {
  return hasRole(user.role, "manager") || project.leadId === user.id;
}

export function projectsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const query = parseQuery(listQuery, req.query);
      const projects = await projectsRepo.list(ctx.db, { status: query.status, memberId: query.mine ? user.id : undefined });
      res.json(projects);
    }),
  );

  router.post(
    "/",
    requireRole("manager"),
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const input = parseBody(createProjectSchema, req.body);
      const project = await ctx.db.transaction(async (tx) => {
        const id = await projectsRepo.create(tx, input);
        const members = new Set([user.id, ...(input.memberIds ?? []), ...(input.leadId ? [input.leadId] : [])]);
        for (const memberId of members) await projectsRepo.addMember(tx, id, memberId);
        await ctx.activity.record(tx, { actorId: user.id, projectId: id, action: "project.created", details: { name: input.name, key: input.key } });
        return projectsRepo.findById(tx, id);
      });
      res.status(201).json(project);
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const project = await projectsRepo.findById(ctx.db, parseId(req.params.id));
      if (!project) throw notFound("Project");
      res.json(project);
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const id = parseId(req.params.id);
      const project = await projectsRepo.findById(ctx.db, id);
      if (!project) throw notFound("Project");
      if (!canManageProject(user, project)) throw forbidden();
      const input = parseBody(updateProjectSchema, req.body);
      const updated = await ctx.db.transaction(async (tx) => {
        await projectsRepo.update(tx, id, input);
        if (input.leadId) await projectsRepo.addMember(tx, id, input.leadId);
        await ctx.activity.record(tx, { actorId: user.id, projectId: id, action: "project.updated", details: { fields: Object.keys(input) } });
        return projectsRepo.findById(tx, id);
      });
      res.json(updated);
    }),
  );

  router.delete(
    "/:id",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const removed = await projectsRepo.remove(ctx.db, parseId(req.params.id));
      if (!removed) throw notFound("Project");
      res.status(204).end();
    }),
  );

  router.get(
    "/:id/members",
    asyncHandler(async (req, res) => {
      const id = parseId(req.params.id);
      if (!(await projectsRepo.findById(ctx.db, id))) throw notFound("Project");
      res.json(await projectsRepo.members(ctx.db, id));
    }),
  );

  router.post(
    "/:id/members",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const id = parseId(req.params.id);
      const project = await projectsRepo.findById(ctx.db, id);
      if (!project) throw notFound("Project");
      if (!canManageProject(user, project)) throw forbidden();
      const { userId } = parseBody(addMemberSchema, req.body);
      await ctx.db.transaction(async (tx) => {
        await projectsRepo.addMember(tx, id, userId);
        await ctx.activity.record(tx, { actorId: user.id, projectId: id, action: "project.member_added", details: { userId } });
      });
      res.status(201).json(await projectsRepo.members(ctx.db, id));
    }),
  );

  router.delete(
    "/:id/members/:userId",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const id = parseId(req.params.id);
      const userId = parseId(req.params.userId, "userId");
      const project = await projectsRepo.findById(ctx.db, id);
      if (!project) throw notFound("Project");
      if (!canManageProject(user, project) && user.id !== userId) throw forbidden();
      await ctx.db.transaction(async (tx) => {
        await projectsRepo.removeMember(tx, id, userId);
        await ctx.activity.record(tx, { actorId: user.id, projectId: id, action: "project.member_removed", details: { userId } });
      });
      res.json(await projectsRepo.members(ctx.db, id));
    }),
  );

  return router;
}
