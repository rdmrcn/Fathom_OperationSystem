import { Router } from "express";
import { changeRoleSchema, updateProfileSchema } from "@stratum/shared";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { asyncHandler, parseBody, parseId } from "../../lib/http.js";
import { currentUser, requireRole } from "../../middleware/auth.js";
import { toUser, usersRepo } from "./repo.js";

const activeSchema = z.object({ isActive: z.boolean() });

export function usersRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const rows = await usersRepo.list(ctx.db);
      res.json(rows.map(toUser));
    }),
  );

  router.get(
    "/me",
    asyncHandler(async (req, res) => {
      const row = await usersRepo.findById(ctx.db, currentUser(req).id);
      if (!row) throw notFound("User");
      res.json(toUser(row));
    }),
  );

  router.patch(
    "/me",
    asyncHandler(async (req, res) => {
      const user = currentUser(req);
      const input = parseBody(updateProfileSchema, req.body);
      await usersRepo.updateProfile(ctx.db, user.id, input);
      const row = await usersRepo.findById(ctx.db, user.id);
      res.json(toUser(row!));
    }),
  );

  router.patch(
    "/:id/role",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const actor = currentUser(req);
      const id = parseId(req.params.id);
      const { role } = parseBody(changeRoleSchema, req.body);
      const target = await usersRepo.findById(ctx.db, id);
      if (!target) throw notFound("User");
      if (target.role === "admin" && role !== "admin" && ((await usersRepo.countAdmins(ctx.db)) ?? 0) <= 1) {
        throw badRequest("The workspace needs at least one administrator");
      }
      await ctx.db.transaction(async (tx) => {
        await usersRepo.updateRole(tx, id, role);
        await ctx.activity.record(tx, { actorId: actor.id, action: "user.role_changed", details: { userId: id, from: target.role, to: role } });
      });
      res.json(toUser((await usersRepo.findById(ctx.db, id))!));
    }),
  );

  router.patch(
    "/:id/active",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const actor = currentUser(req);
      const id = parseId(req.params.id);
      if (id === actor.id) throw badRequest("You cannot deactivate your own account");
      const { isActive } = parseBody(activeSchema, req.body);
      const updated = await usersRepo.setActive(ctx.db, id, isActive);
      if (!updated) throw notFound("User");
      if (!isActive) await ctx.auth.revokeAll(id);
      res.json(toUser((await usersRepo.findById(ctx.db, id))!));
    }),
  );

  return router;
}
