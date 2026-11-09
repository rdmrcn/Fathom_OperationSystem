import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mssql from "mssql";
import type { Env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { buildConnectionConfig, createDatabase, type Database } from "./pool.js";
import { raw, sql } from "./sql.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** Splits a T-SQL script on `GO` batch separators (a line containing only GO). */
export function splitBatches(script: string): string[] {
  return script
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);
}

function quoteIdent(name: string): string {
  return `[${name.replace(/]/g, "]]")}]`;
}

/** Creates the application database if it does not exist (connects to `master`). */
export async function ensureDatabaseExists(env: Env): Promise<boolean> {
  const master = await createDatabase(buildConnectionConfig(env, { database: "master", pool: { max: 1, min: 0 } }));
  try {
    const exists = await master.scalar<number>(sql`SELECT COUNT(*) FROM sys.databases WHERE name = ${env.DB_NAME}`);
    if (exists) return false;
    await master.execute(sql`${raw(`CREATE DATABASE ${quoteIdent(env.DB_NAME)}`)}`);
    logger.info({ database: env.DB_NAME }, "Created database");
    return true;
  } finally {
    await master.close();
  }
}

export async function dropDatabase(env: Env): Promise<void> {
  const master = await createDatabase(buildConnectionConfig(env, { database: "master", pool: { max: 1, min: 0 } }));
  try {
    const exists = await master.scalar<number>(sql`SELECT COUNT(*) FROM sys.databases WHERE name = ${env.DB_NAME}`);
    if (!exists) return;
    const name = quoteIdent(env.DB_NAME);
    await master.execute(sql`${raw(`ALTER DATABASE ${name} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ${name};`)}`);
    logger.info({ database: env.DB_NAME }, "Dropped database");
  } finally {
    await master.close();
  }
}

export async function listMigrationFiles(): Promise<{ version: string; file: string }[]> {
  const entries = await readdir(migrationsDir);
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ version: file.replace(/\.sql$/, ""), file: path.join(migrationsDir, file) }));
}

/** Applies pending migrations in order. Each file runs inside one transaction. */
export async function runMigrations(db: Database): Promise<string[]> {
  await db.execute(sql`
    IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
      CREATE TABLE dbo.SchemaMigrations (
        Version   NVARCHAR(100) NOT NULL CONSTRAINT PK_SchemaMigrations PRIMARY KEY,
        AppliedAt DATETIME2(3)  NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT (SYSUTCDATETIME())
      )`);

  const applied = new Set(
    (await db.query<{ Version: string }>(sql`SELECT Version FROM dbo.SchemaMigrations`)).map((r) => r.Version),
  );
  const pending = (await listMigrationFiles()).filter((m) => !applied.has(m.version));
  const done: string[] = [];

  for (const migration of pending) {
    const script = await readFile(migration.file, "utf8");
    const batches = splitBatches(script);
    await db.transaction(async (tx) => {
      for (const batch of batches) {
        await tx.execute(sql`${raw(batch)}`);
      }
      await tx.execute(sql`INSERT INTO dbo.SchemaMigrations (Version) VALUES (${migration.version})`);
    });
    logger.info({ version: migration.version, batches: batches.length }, "Applied migration");
    done.push(migration.version);
  }
  return done;
}

/**
 * Creates (or re-points) the least-privilege reporting login when configured.
 * Idempotent; requires a server-level principal such as `sa` for the app pool.
 */
export async function ensureReportingLogin(env: Env, db: Database): Promise<boolean> {
  if (!env.DB_REPORTING_USER || !env.DB_REPORTING_PASSWORD) return false;
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(env.DB_REPORTING_USER)) {
    throw new Error("DB_REPORTING_USER must be a simple identifier");
  }
  const login = quoteIdent(env.DB_REPORTING_USER);
  const password = env.DB_REPORTING_PASSWORD.replace(/'/g, "''");
  await db.execute(sql`${raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'${env.DB_REPORTING_USER.replace(/'/g, "''")}')
      CREATE LOGIN ${login} WITH PASSWORD = N'${password}', CHECK_POLICY = OFF;
    ELSE
      ALTER LOGIN ${login} WITH PASSWORD = N'${password}';
    IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${env.DB_REPORTING_USER.replace(/'/g, "''")}')
      CREATE USER ${login} FOR LOGIN ${login};
    ALTER ROLE reporting_reader ADD MEMBER ${login};
  `)}`);
  logger.info({ login: env.DB_REPORTING_USER }, "Reporting login ready");
  return true;
}

/** Convenience used by the CLI and the integration tests: ensure DB, migrate, optional login. */
export async function migrateAll(env: Env): Promise<{ created: boolean; applied: string[] }> {
  const created = await ensureDatabaseExists(env);
  const db = await createDatabase(buildConnectionConfig(env, { pool: { max: 2, min: 0 } }));
  try {
    const applied = await runMigrations(db);
    await ensureReportingLogin(env, db);
    return { created, applied };
  } finally {
    await db.close();
  }
}

export { mssql };
