import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info");

export const logger = pino({
  level,
  base: { service: "fathom-api" },
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.passwordHash", "*.refreshToken"],
});
