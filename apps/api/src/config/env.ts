import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Loads `.env` files without a dependency: Node 20.12+ ships `process.loadEnvFile`.
 * Variables already present in the environment win (so Docker/CI can override).
 */
function loadDotEnv(): void {
  const loader = (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof loader !== "function") return;
  const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      loader.call(process, file);
      return;
    } catch {
      // Ignore malformed files; validation below reports what is missing.
    }
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://127.0.0.1:5173,http://localhost:4000,http://127.0.0.1:4000"),

  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().default(1433),
  DB_NAME: z.string().default("Fathom"),
  DB_USER: z.string().default("sa"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_ENCRYPT: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  DB_TRUST_SERVER_CERTIFICATE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /** Optional least-privilege login used only by the assistant's report queries. */
  DB_REPORTING_USER: z.string().optional(),
  DB_REPORTING_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(15 * 60),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(7),

  /** Any OpenAI-compatible chat-completions endpoint. Leave the key empty to use the built-in engine. */
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),

  SEED_DEMO_PASSWORD: z.string().default("Password123!"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  if (cached && Object.keys(overrides).length === 0) return cached;
  loadDotEnv();
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  if (Object.keys(overrides).length === 0) cached = parsed.data;
  return parsed.data;
}

export function resetEnvCache(): void {
  cached = null;
}
