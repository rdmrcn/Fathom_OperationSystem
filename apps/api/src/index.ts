import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { createContext } from "./context.js";
import { migrateAll } from "./db/migrate.js";
import { closeDatabases, getDatabase, getReportingDatabase } from "./db/pool.js";
import { seedDatabase } from "./db/seed.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  const env = getEnv();

  // Make a fresh environment usable with a single command: create the database,
  // apply pending migrations and seed demo data when the database is empty.
  if (process.env.AUTO_MIGRATE !== "false") {
    const { created, applied } = await migrateAll(env);
    if (created || applied.length) logger.info({ created, applied }, "Database schema ready");
  }
  const db = await getDatabase();
  if (process.env.AUTO_SEED !== "false") {
    const seeded = await seedDatabase(db, { demoPassword: env.SEED_DEMO_PASSWORD });
    if (seeded) logger.info({ ...seeded, admin: "admin@fathom.dev" }, "Seeded demo workspace");
  }
  const reportingDb = await getReportingDatabase();

  const ctx = createContext(env, db, reportingDb);
  const app = createApp(ctx);
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, llm: ctx.llm?.model ?? "built-in engine", reportingLogin: reportingDb !== db }, "Fathom API listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => {
      closeDatabases().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "API failed to start");
  process.exit(1);
});
