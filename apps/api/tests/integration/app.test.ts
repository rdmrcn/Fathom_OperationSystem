import type { AuthResponse, DashboardStats, Paginated, Project, Task } from "@stratum/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContext } from "../../src/context.js";
import { getEnv, resetEnvCache } from "../../src/config/env.js";
import { dropDatabase, migrateAll } from "../../src/db/migrate.js";
import { buildConnectionConfig, createDatabase, type Database } from "../../src/db/pool.js";
import { seedDatabase } from "../../src/db/seed.js";

const DB_NAME = "Fathom_it";

describe("API integration", () => {
  let db: Database;
  let agent: ReturnType<typeof request>;
  let adminToken: string;
  let memberToken: string;
  let memberRefresh: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DB_NAME = DB_NAME;
    process.env.LOG_LEVEL = "silent";
    resetEnvCache();
    const env = getEnv({ NODE_ENV: "test", DB_NAME, LOG_LEVEL: "silent" });
    await dropDatabase(env);
    await migrateAll(env);
    db = await createDatabase(buildConnectionConfig(env, { pool: { max: 4, min: 0 } }));
    await seedDatabase(db, { demoPassword: env.SEED_DEMO_PASSWORD, force: true });
    const app = createApp(createContext(env, db, db));
    agent = request(app);

    const admin = await agent.post("/api/auth/login").send({ email: "admin@fathom.dev", password: env.SEED_DEMO_PASSWORD }).expect(200);
    adminToken = (admin.body as AuthResponse).accessToken;
    const member = await agent.post("/api/auth/login").send({ email: "member@fathom.dev", password: env.SEED_DEMO_PASSWORD }).expect(200);
    memberToken = (member.body as AuthResponse).accessToken;
    memberRefresh = (member.body as AuthResponse).refreshToken;
  }, 90_000);

  afterAll(async () => {
    await db?.close();
  });

  it("health reports SQL Server", async () => {
    const res = await agent.get("/api/health").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
    expect(String(res.headers["content-security-policy"] ?? "")).not.toMatch(/upgrade-insecure-requests/i);
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("rejects unauthenticated dashboard access", async () => {
    await agent.get("/api/dashboard").expect(401);
  });

  it("returns dashboard totals from the seed", async () => {
    const res = await agent.get("/api/dashboard").set("authorization", `Bearer ${adminToken}`).expect(200);
    const body = res.body as DashboardStats;
    expect(body.totals.projects).toBe(5);
    expect(body.totals.members).toBe(8);
    expect(body.totals.openTasks).toBeGreaterThan(0);
    expect(body.throughput).toHaveLength(8);
    expect(body.throughput.reduce((sum, week) => sum + week.created, 0)).toBeGreaterThan(0);
  });

  it("lists projects and a Kanban board", async () => {
    const projects = await agent.get("/api/projects").set("authorization", `Bearer ${adminToken}`).expect(200);
    const pay = (projects.body as Project[]).find((p) => p.key === "PAY");
    expect(pay).toBeTruthy();
    const board = await agent.get(`/api/tasks/board/${pay!.id}`).set("authorization", `Bearer ${adminToken}`).expect(200);
    expect((board.body as Task[]).length).toBe(pay!.taskCount);
  });

  it("creates, moves and comments on a task", async () => {
    const projects = await agent.get("/api/projects").set("authorization", `Bearer ${adminToken}`);
    const pay = (projects.body as Project[]).find((p) => p.key === "PAY")!;
    const created = await agent
      .post("/api/tasks")
      .set("authorization", `Bearer ${adminToken}`)
      .send({ projectId: pay.id, title: "Integration test task", priority: "high", labels: ["it"] })
      .expect(201);
    const task = created.body as Task;
    expect(task.key).toMatch(/^PAY-\d+$/);

    await agent
      .post(`/api/tasks/${task.id}/move`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({ status: "in_progress", orderedIds: [task.id] })
      .expect(200);

    const comments = await agent
      .post(`/api/tasks/${task.id}/comments`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({ body: "Looks good from the integration test." })
      .expect(201);
    expect(comments.body).toHaveLength(1);
  });

  it("answers overdue questions through the built-in assistant", async () => {
    const res = await agent
      .post("/api/assistant/chat")
      .set("authorization", `Bearer ${adminToken}`)
      .send({ message: "Which tasks are overdue?" })
      .expect(200);
    const text = res.body.assistantMessage.content as string;
    expect(res.body.assistantMessage.source).toBe("builtin");
    expect(text).toMatch(/OPS-5|PAY-7|PAY-10/);
    expect(res.body.assistantMessage.toolTrace[0].tool).toBe("search_tasks");
  });

  it("looks up a task by key via the assistant", async () => {
    const res = await agent
      .post("/api/assistant/chat")
      .set("authorization", `Bearer ${adminToken}`)
      .send({ message: "What's the status of PAY-7?" })
      .expect(200);
    expect(res.body.assistantMessage.content).toMatch(/PAY-7/);
    expect(res.body.assistantMessage.content).toMatch(/Webhook/i);
  });

  it("forbids a member from creating a project", async () => {
    await agent
      .post("/api/projects")
      .set("authorization", `Bearer ${memberToken}`)
      .send({ key: "ZZZ", name: "Should fail" })
      .expect(403);
  });

  it("detects refresh-token reuse", async () => {
    const first = await agent.post("/api/auth/refresh").send({ refreshToken: memberRefresh }).expect(200);
    expect((first.body as AuthResponse).accessToken).toBeTruthy();
    await agent.post("/api/auth/refresh").send({ refreshToken: memberRefresh }).expect(401);
  });

  it("paginates activity", async () => {
    const res = await agent.get("/api/activity?pageSize=5").set("authorization", `Bearer ${adminToken}`).expect(200);
    const body = res.body as Paginated<unknown>;
    expect(body.items).toHaveLength(5);
    expect(body.total).toBeGreaterThan(5);
  });

  it("keeps the task key in activity after a delete", async () => {
    const projects = await agent.get("/api/projects").set("authorization", `Bearer ${adminToken}`);
    const pay = (projects.body as Project[]).find((p) => p.key === "PAY")!;
    const created = await agent
      .post("/api/tasks")
      .set("authorization", `Bearer ${adminToken}`)
      .send({ projectId: pay.id, title: "Soon to be deleted" })
      .expect(201);
    const task = created.body as Task;
    await agent.delete(`/api/tasks/${task.id}`).set("authorization", `Bearer ${adminToken}`).expect(204);
    const res = await agent.get("/api/activity?pageSize=10").set("authorization", `Bearer ${adminToken}`).expect(200);
    const body = res.body as Paginated<{ action: string; taskId: number | null; taskKey: string | null; taskTitle: string | null; details: { key?: string; title?: string } }>;
    const deleted = body.items.find((item) => item.action === "task.deleted" && item.details.key === task.key);
    expect(deleted).toBeTruthy();
    expect(deleted!.taskId).toBeNull();
    expect(deleted!.taskKey).toBe(task.key);
    expect(deleted!.taskTitle).toBe("Soon to be deleted");
  });
});
