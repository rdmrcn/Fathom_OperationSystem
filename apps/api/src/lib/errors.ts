import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what = "Resource") => new HttpError(404, "not_found", `${what} not found`);
export const forbidden = (message = "You do not have permission to do that") => new HttpError(403, "forbidden", message);
export const unauthorized = (message = "Authentication required") => new HttpError(401, "unauthorized", message);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, "bad_request", message, details);
export const conflict = (message: string, code = "conflict") => new HttpError(409, code, message);

/** SQL Server error numbers that map to a 409 (unique index / constraint violations). */
const UNIQUE_VIOLATION = new Set([2601, 2627]);
const FK_VIOLATION = 547;

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid request",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
    return;
  }
  const sqlNumber = (err as { number?: number })?.number;
  if (typeof sqlNumber === "number" && UNIQUE_VIOLATION.has(sqlNumber)) {
    res.status(409).json({ error: { code: "conflict", message: "A record with the same unique value already exists" } });
    return;
  }
  if (sqlNumber === FK_VIOLATION) {
    res.status(400).json({ error: { code: "invalid_reference", message: "A referenced record does not exist or is still in use" } });
    return;
  }
  if ((err as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
    return;
  }
  logger.error({ err, url: req.originalUrl }, "Unhandled error");
  res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
};
