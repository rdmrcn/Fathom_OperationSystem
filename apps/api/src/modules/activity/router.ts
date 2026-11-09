import { Router } from "express";
import { activityFilterSchema } from "@stratum/shared";
import type { AppContext } from "../../context.js";
import { asyncHandler, parseQuery } from "../../lib/http.js";

export function activityRouter(ctx: AppContext): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const filter = parseQuery(activityFilterSchema, req.query);
      res.json(await ctx.activity.list(ctx.db, filter));
    }),
  );
  return router;
}
