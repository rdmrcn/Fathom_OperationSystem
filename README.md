# Fathom

**AI-assisted project & operations management** — a full-stack portfolio piece: React 19 + Vite, Node/Express 5, and **Microsoft SQL Server**.

Built by Reha Demircan. Demo data only; nothing here is a production deployment.

> The assistant answers from **live SQL Server data**. Without an API key it uses a built-in, tool-using engine. With `AI_API_KEY` it calls any OpenAI-compatible model, which may run a guarded `SELECT` against reporting views.

## Why this project exists

Recruiters see a lot of “todo apps with a chat widget.” Fathom is meant to show the opposite:

- A real **T-SQL schema** (keys, check constraints, filtered indexes, a `reporting` schema).
- Parameterised queries (no string-concatenated SQL).
- **JWT access + rotating refresh tokens** (reuse of a spent refresh token revokes the family).
- Role-based access (admin / manager / member).
- An assistant that **calls tools** (`search_tasks`, `get_project_summary`, `run_report_query`, `create_task`, …) instead of hallucinating the backlog.
- The report tool is defence-in-depth: a SQL guard *and* a least-privilege `reporting_reader` login that can only `SELECT` views (no emails, hashes or tokens).

## Stack

| Layer | Choice |
| --- | --- |
| Web | React 19, Vite, Tailwind CSS 4, TanStack Query, Zustand, dnd-kit, Recharts, React Router 7 |
| API | Express 5, `mssql`/Tedious, Zod 4, JWT, bcryptjs, Pino |
| Data | SQL Server 2022 (Developer / Express / Azure SQL) |
| AI | Optional OpenAI-compatible `/chat/completions`; built-in engine otherwise |
| Tests | Vitest (unit + API integration against a real SQL Server) |

GitHub: [rdmrcn/Fathom_OperationSystem](https://github.com/rdmrcn/Fathom_OperationSystem)

Türkçe adım adım kurulum: [`KULLANIM_KILAVUZU.txt`](./KULLANIM_KILAVUZU.txt)

## Quick start

Prerequisites: **Node.js 20+** and **Docker Desktop** (SQL Server 2022).

```bash
git clone https://github.com/rdmrcn/Fathom_OperationSystem.git
cd Fathom_OperationSystem
npm install
npm run dev                   # copies .env, starts SQL Server, then API :4000 + web :5173
```

`npm run dev` starts Docker SQL Server if it can, waits for port 1433, then the API and Vite. First boot can take a minute while the database image pulls. Open **http://localhost:5173** only after the terminal shows the API listening.

If you already have SQL Server on 1433, skip Docker; the API uses `DB_PASSWORD=Fathom!Dev2026` from `.env.example`.

On first start the API also migrates and seeds if the database is empty (`AUTO_MIGRATE` / `AUTO_SEED`).

Open http://localhost:5173. After `npm run build`, `npm start` also serves the UI from the API at http://localhost:4000 (same origin, no proxy).

| Email | Password | Role |
| --- | --- | --- |
| `admin@fathom.dev` | `Password123!` | Admin |
| `manager@fathom.dev` | `Password123!` | Manager |
| `member@fathom.dev` | `Password123!` | Member |

(Five more people are seeded for workload charts.)

### SQL Server without Docker

Any instance works. Point `.env` at it:

```
DB_HOST=localhost
DB_PORT=1433
DB_NAME=Fathom
DB_USER=sa
DB_PASSWORD=YourPasswordHere
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true   # local / self-signed
```

Azure SQL: set `DB_TRUST_SERVER_CERTIFICATE=false` and use a SQL login.

## Optional language model

Leave `AI_API_KEY` empty to stay fully offline. To phrase answers (and to generate richer task breakdowns) set:

```
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1   # or Groq, OpenRouter, Ollama, Azure proxy…
AI_MODEL=gpt-4o-mini
```

The model never talks to the database directly. It can only call the same tools the built-in engine uses. `run_report_query` is limited to `SELECT` on `reporting.vTasks|vProjects|vUsers|vActivity|vComments`, max 50 rows.

## What to click through in an interview

1. **Sign in** as admin (EN/TR toggle on the login screen). Dashboard charts are live aggregates from SQL Server; each project shows a health score.
2. **⌘K** is a command palette — type `today` or `PAY-7`. Press `g` then `t` for Today, `?` for shortcuts.
3. Open **Today** (standup markdown), **Inbox** (unread activity), **Calendar**, and **Reports** (CSV + JSON).
4. Open **Payments Platform** — five-column Kanban, drag-and-drop, task drawer (edit, comments, history).
5. **Ask AI** (⌘J, Ask AI in the header, or `/assistant`):
   - “Which tasks are overdue?”
   - “Summarise the Payments Platform project”
   - “What should I work on today?”
   - “Who has the heaviest workload?”
   - “What's the status of PAY-7?”
   - “Create a task in OPS: rotate the staging database password, high priority, assign to Can”
6. **Break down a goal** on a board — suggestions first, then you choose which land in the backlog.
7. Open **Settings → About this demo** for the architecture talking points.
8. Sign in as `member@fathom.dev` and try creating a project (403).

## Repository layout

```
apps/web          Vite + React SPA
apps/api          Express API, T-SQL migrations, assistant
packages/shared   Zod schemas and DTO types shared by both apps
```

Schema lives in `apps/api/src/db/migrations/*.sql`. The runner splits on `GO` and records versions in `dbo.SchemaMigrations`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API + web together |
| `npm run build` | Shared → API → web |
| `npm start` | One Node process: API **and** the built React app (http://localhost:4000) |
| `npm run db:migrate` / `db:seed` / `db:reset` | Schema and demo data |
| `npm test` | Unit tests |
| `npm run test:integration` | Hits a real SQL Server (`Fathom_it`) |
| `npm run check` | lint + typecheck + unit tests |

`db:reset` drops the database; it refuses to run when `NODE_ENV=production` unless `ALLOW_DB_RESET=true`.

## Architecture notes (talking points)

- **Task keys** (`PAY-42`) come from `Projects.NextTaskNumber`, allocated with `UPDATE … OUTPUT deleted.NextTaskNumber` so concurrent creates cannot collide.
- **Kanban order** is a `FLOAT Position` rewritten on drop; the API never trusts the client’s prices — there are no prices; it never trusts unordered ids without the moved task.
- **Checkout of money is out of scope**; this is an internal ops tool, not a store.
- **Refresh-token rotation**: only the SHA-256 of the token is stored. Presenting a revoked token revokes every session for that user.
- **Assistant conversations** persist in `dbo.Conversations` / `dbo.Messages` with a JSON `ToolTrace`.

## “Request failed (502)”

The UI is running; the **API is not**. The login form talks to `localhost:4000`, which needs SQL Server.

1. Install / start **Docker Desktop**.
2. In the project folder: `docker compose up -d` then wait until `docker compose ps` shows `healthy`.
3. `npm run dev` again and wait for `Fathom API listening`.
4. Sign in at http://localhost:5173 with `admin@fathom.dev` / `Password123!`.

Do not open only the Vite page after an API crash — the purple UI can still load while `/api/auth/login` returns 502.

## Known limits

- Single-region demo; no multi-tenancy (one workspace).
- The built-in assistant is keyword + tool based — unusual phrasing can miss. A real model covers that when `AI_API_KEY` is set.
- No email verification, password reset or SSO.
- Integration tests require a reachable SQL Server.
- Not a production deployment: add TLS at a reverse proxy, rotate `JWT_SECRET`, and do not expose `sa` on the internet.

## Licence

UNLICENSED — Copyright (c) 2026 Reha Demircan. See the repository `LICENSE`.
