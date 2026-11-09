import mssql from "mssql";
import type { Env } from "../config/env.js";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { bindParams, type SqlFragment } from "./sql.js";

export interface QueryRunner {
  query<T = Record<string, unknown>>(fragment: SqlFragment): Promise<T[]>;
  one<T = Record<string, unknown>>(fragment: SqlFragment): Promise<T | null>;
  scalar<T = unknown>(fragment: SqlFragment): Promise<T | null>;
  execute(fragment: SqlFragment): Promise<number>;
}

export interface Database extends QueryRunner {
  pool: mssql.ConnectionPool;
  transaction<T>(fn: (tx: QueryRunner) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function makeRunner(requestFactory: () => mssql.Request, timeoutMs?: number): QueryRunner {
  async function run(fragment: SqlFragment) {
    const { text, params } = fragment.compile();
    const request = requestFactory();
    if (timeoutMs) (request as unknown as { timeout?: number }).timeout = timeoutMs;
    bindParams(request, params);
    return request.query(text);
  }
  return {
    async query<T>(fragment: SqlFragment): Promise<T[]> {
      const result = await run(fragment);
      return result.recordset as unknown as T[];
    },
    async one<T>(fragment: SqlFragment): Promise<T | null> {
      const result = await run(fragment);
      return ((result.recordset as unknown as T[])[0] as T | undefined) ?? null;
    },
    async scalar<T>(fragment: SqlFragment): Promise<T | null> {
      const result = await run(fragment);
      const row = result.recordset?.[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      const first = Object.values(row)[0];
      return (first as T | undefined) ?? null;
    },
    async execute(fragment: SqlFragment): Promise<number> {
      const result = await run(fragment);
      return result.rowsAffected.reduce((a, b) => a + b, 0);
    },
  };
}

export function buildConnectionConfig(env: Env, overrides: Partial<mssql.config> = {}): mssql.config {
  return {
    server: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    pool: { max: env.DB_POOL_MAX, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: env.DB_ENCRYPT,
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
      useUTC: true,
      enableArithAbort: true,
    },
    requestTimeout: 15_000,
    connectionTimeout: 15_000,
    ...overrides,
  };
}

export async function createDatabase(config: mssql.config, options: { requestTimeoutMs?: number } = {}): Promise<Database> {
  const pool = new mssql.ConnectionPool(config);
  pool.on("error", (err) => logger.error({ err }, "SQL Server pool error"));
  await pool.connect();

  const runner = makeRunner(() => pool.request(), options.requestTimeoutMs);
  return {
    ...runner,
    pool,
    async transaction<T>(fn: (tx: QueryRunner) => Promise<T>): Promise<T> {
      const tx = new mssql.Transaction(pool);
      await tx.begin(mssql.ISOLATION_LEVEL.READ_COMMITTED);
      try {
        const result = await fn(makeRunner(() => new mssql.Request(tx)));
        await tx.commit();
        return result;
      } catch (err) {
        try {
          await tx.rollback();
        } catch {
          // Already rolled back by the server (e.g. deadlock victim).
        }
        throw err;
      }
    },
    async close() {
      await pool.close();
    },
  };
}

let shared: Promise<Database> | null = null;

/** Lazily connected application pool. */
export function getDatabase(): Promise<Database> {
  if (!shared) {
    const env = getEnv();
    shared = createDatabase(buildConnectionConfig(env)).catch((err) => {
      shared = null;
      throw err;
    });
  }
  return shared;
}

let reporting: Promise<Database> | null | undefined;

/**
 * Pool used by the assistant's read-only report tool. When a dedicated
 * least-privilege login is configured it is used; otherwise falls back to the
 * application pool (the SQL guard still applies).
 */
export function getReportingDatabase(): Promise<Database> {
  if (reporting === undefined) {
    const env = getEnv();
    if (env.DB_REPORTING_USER && env.DB_REPORTING_PASSWORD) {
      reporting = createDatabase(
        buildConnectionConfig(env, {
          user: env.DB_REPORTING_USER,
          password: env.DB_REPORTING_PASSWORD,
          pool: { max: 3, min: 0, idleTimeoutMillis: 30_000 },
          requestTimeout: 5_000,
        }),
        { requestTimeoutMs: 5_000 },
      ).catch((err) => {
        logger.warn({ err }, "Reporting login unavailable, falling back to the application pool");
        reporting = null;
        return getDatabase();
      });
    } else {
      reporting = null;
    }
  }
  return reporting ?? getDatabase();
}

export async function closeDatabases(): Promise<void> {
  const pools = [shared, reporting].filter(Boolean) as Promise<Database>[];
  shared = null;
  reporting = undefined;
  await Promise.all(pools.map((p) => p.then((db) => db.close()).catch(() => undefined)));
}
