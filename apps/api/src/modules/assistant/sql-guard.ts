/**
 * Validates SQL produced by the assistant before it is run against the
 * `reporting` schema. Defence in depth: the query should also run under a
 * login that can only SELECT from that schema (see DB_REPORTING_USER).
 */

export const REPORTING_VIEWS = ["vTasks", "vProjects", "vUsers", "vActivity", "vComments"] as const;

export const MAX_REPORT_ROWS = 50;

const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "merge",
  "drop",
  "alter",
  "create",
  "truncate",
  "exec",
  "execute",
  "grant",
  "revoke",
  "deny",
  "into",
  "openrowset",
  "openquery",
  "opendatasource",
  "bulk",
  "waitfor",
  "shutdown",
  "backup",
  "restore",
  "dbcc",
  "kill",
  "reconfigure",
  "xp_",
  "sp_",
  "sys.",
  "information_schema",
  "revert",
  "cursor",
  "declare",
];

export interface GuardResult {
  ok: boolean;
  /** Normalised SQL ready to execute (when ok). */
  sql?: string;
  reason?: string;
}

function stripComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

export function guardReportQuery(input: string): GuardResult {
  if (typeof input !== "string") return { ok: false, reason: "SQL must be a string" };
  let text = stripComments(input).trim();
  if (text.endsWith(";")) text = text.slice(0, -1).trim();
  if (text.length === 0) return { ok: false, reason: "Empty query" };
  if (text.length > 4000) return { ok: false, reason: "Query is too long" };
  if (text.includes(";")) return { ok: false, reason: "Only a single statement is allowed" };
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      return { ok: false, reason: "Control characters are not allowed" };
    }
  }

  const lower = text.toLowerCase();
  if (!/^(select|with)\b/.test(lower)) return { ok: false, reason: "Only SELECT statements are allowed" };

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Prefix-style keywords (xp_, sp_, sys.) match anything that starts with them.
    const pattern = /[._]$/.test(keyword) ? new RegExp(`\\b${escaped}`, "i") : new RegExp(`\\b${escaped}\\b`, "i");
    if (pattern.test(lower)) return { ok: false, reason: `Keyword "${keyword}" is not allowed` };
  }

  // Every table reference must be a reporting view.
  const refs = [...lower.matchAll(/\b(?:from|join|apply)\s+(\(?)\s*([a-z0-9_[\]".]+)/gi)];
  for (const ref of refs) {
    if (ref[1] === "(") continue; // derived table / subquery – its own FROM is checked by this loop
    const name = ref[2].replace(/[[\]"]/g, "");
    const parts = name.split(".");
    if (parts.length !== 2 || parts[0] !== "reporting") {
      return { ok: false, reason: `Only views in the reporting schema may be queried (got "${name}")` };
    }
    if (!REPORTING_VIEWS.some((v) => v.toLowerCase() === parts[1])) {
      return { ok: false, reason: `Unknown reporting view "${parts[1]}"` };
    }
  }
  if (refs.length === 0) return { ok: false, reason: "Query must read from a reporting view" };

  return { ok: true, sql: text };
}

/** Describes the reporting views for the model's system prompt. */
export const REPORTING_SCHEMA_DOC = `
reporting.vTasks(TaskId int, TaskKey nvarchar e.g. 'PAY-7', ProjectId int, ProjectKey nvarchar, ProjectName nvarchar, Title nvarchar,
  Status in ('backlog','todo','in_progress','in_review','done'), Priority in ('low','medium','high','critical'),
  Type in ('feature','bug','chore','research'), AssigneeId int null, AssigneeName nvarchar null, ReporterId int, ReporterName nvarchar,
  DueDate date null, EstimateHours decimal null, Labels nvarchar JSON array, CreatedAt datetime2, UpdatedAt datetime2, CompletedAt datetime2 null,
  IsOverdue bit, CycleTimeDays int null)
reporting.vProjects(ProjectId int, ProjectKey nvarchar, ProjectName nvarchar, Status in ('active','on_hold','completed','archived'),
  StartDate date null, TargetDate date null, LeadId int null, LeadName nvarchar null, CreatedAt, UpdatedAt,
  TaskCount int, DoneCount int, OverdueCount int, MemberCount int)
reporting.vUsers(UserId int, Name nvarchar, Role in ('admin','manager','member'), JobTitle nvarchar null, IsActive bit, CreatedAt)
reporting.vActivity(ActivityId bigint, Action nvarchar, ActorId int null, ActorName nvarchar null, ProjectId int null, ProjectKey nvarchar null, TaskId int null, CreatedAt)
reporting.vComments(CommentId int, TaskId int, AuthorId int, AuthorName nvarchar, BodyLength int, CreatedAt)
Dialect: T-SQL (SQL Server). Use TOP (n) not LIMIT. Dates: CAST(SYSUTCDATETIME() AS DATE) is today. Only SELECT; one statement; only these views.`.trim();
