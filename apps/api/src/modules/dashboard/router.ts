import { Router } from "express";
import type { AppContext } from "../../context.js";
import { asyncHandler } from "../../lib/http.js";
import { getDashboardStats } from "./service.js";

export function dashboardRouter(ctx: AppContext): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      res.json(await getDashboardStats(ctx));
    }),
  );
  return router;
}
