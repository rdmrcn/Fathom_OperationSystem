import type { Env } from "./config/env.js";
import type { Database } from "./db/pool.js";
import { AuthService, tokenConfigFromEnv } from "./modules/auth/service.js";
import type { TokenConfig } from "./modules/auth/tokens.js";
import { ActivityService } from "./modules/activity/service.js";
import { getLlmClient, type LlmClient } from "./modules/assistant/llm.js";

export interface AppContext {
  env: Env;
  db: Database;
  /** Pool for the assistant's read-only report queries (may equal `db`). */
  reportingDb: Database;
  tokens: TokenConfig;
  auth: AuthService;
  activity: ActivityService;
  llm: LlmClient | null;
}

export function createContext(env: Env, db: Database, reportingDb: Database = db, options: { fetchImpl?: typeof fetch } = {}): AppContext {
  const tokens = tokenConfigFromEnv(env);
  return {
    env,
    db,
    reportingDb,
    tokens,
    auth: new AuthService(db, tokens),
    activity: new ActivityService(),
    llm: getLlmClient(env, options.fetchImpl),
  };
}
