import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";
import { badRequest } from "./errors.js";

type AsyncHandler = (req: Request, res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => Promise<unknown>;

/** Express 5 forwards rejected promises to the error handler; this keeps the types tidy. */
export const asyncHandler =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw result.error;
  return result.data;
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query ?? {});
  if (!result.success) throw result.error;
  return result.data;
}

export function parseId(value: string | string[] | undefined, name = "id"): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
}

export function paramString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
