import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { dropDatabase, migrateAll } from "./migrate.js";
import { buildConnectionConfig, createDatabase } from "./pool.js";
import { seedDatabase } from "./seed.js";

async function seed(force: boolean): Promise<void> {
  const env = getEnv();
  const db = await createDatabase(buildConnectionConfig(env, { pool: { max: 2, min: 0 } }));
  try {
    const result = await seedDatabase(db, { demoPassword: env.SEED_DEMO_PASSWORD, force });
    if (!result) {
      logger.info("Database already has users; skipping seed (use db:reset for a clean slate)");
      return;
    }
    logger.info(result, "Seeded demo workspace");
    logger.info({ email: "admin@fathom.dev", password: env.SEED_DEMO_PASSWORD }, "Demo admin credentials");
  } finally {
    await db.close();
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const env = getEnv();
  switch (command) {
    case "migrate": {
      const { created, applied } = await migrateAll(env);
      logger.info({ created, applied }, "Migrations complete");
      break;
    }
    case "seed":
      await seed(false);
      break;
    case "reset": {
      if (env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "true") {
        throw new Error("Refusing to reset a production database without ALLOW_DB_RESET=true");
      }
      await dropDatabase(env);
      await migrateAll(env);
      await seed(true);
      break;
    }
    default:
      console.error("Usage: cli.ts <migrate|seed|reset>");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  logger.error({ err }, "Database command failed");
  process.exitCode = 1;
});
