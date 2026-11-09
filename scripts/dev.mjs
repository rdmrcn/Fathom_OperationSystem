#!/usr/bin/env node
/**
 * Local demo entry: copy .env, start SQL Server if Docker is available,
 * wait until port 1433 accepts connections, then run API + Vite together.
 */
import { copyFileSync, existsSync } from "node:fs";
import { createConnection } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

if (!existsSync(".env") && existsSync(".env.example")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

function run(command, args, opts = {}) {
  return spawnSync(command, args, { stdio: "inherit", ...opts });
}

function dockerComposeUp() {
  const modern = run("docker", ["compose", "version"], { stdio: "ignore" });
  if (modern.status === 0) return run("docker", ["compose", "up", "-d"]);
  const legacy = run("docker-compose", ["version"], { stdio: "ignore" });
  if (legacy.status === 0) return run("docker-compose", ["up", "-d"]);
  return { status: 1 };
}

function waitForPort(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ host, port });
      socket.setTimeout(2000);
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      const retry = () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Nothing is listening on ${host}:${port}. Is SQL Server running?`));
          return;
        }
        setTimeout(attempt, 1500);
      };
      socket.once("error", retry);
      socket.once("timeout", retry);
    };
    attempt();
  });
}

console.log("Starting SQL Server (Docker) if available…");
const compose = dockerComposeUp();
if (compose.status !== 0) {
  console.warn("Docker Compose did not start. If SQL Server is already on port 1433, that is fine.");
}

try {
  console.log("Waiting for SQL Server on 127.0.0.1:1433…");
  await waitForPort("127.0.0.1", 1433, 90_000);
  console.log("SQL Server port is open. Starting API + web.");
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  console.error("Fix: install Docker Desktop, then from this folder run:\n  docker compose up -d\n  npm run dev\n");
}

const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev:apps"], { stdio: "inherit", shell: false });
child.on("exit", (code) => process.exit(code ?? 1));
