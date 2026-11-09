import type { AssistantToolTrace, TaskPriority, TaskStatus } from "@stratum/shared";
import { extractTaskKeys, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@stratum/shared";
import { projectsRepo } from "../projects/repo.js";
import { usersRepo } from "../users/repo.js";
import { runTool, type CompactTask, type ToolContext } from "./tools.js";

export interface BuiltinReply {
  content: string;
  trace: AssistantToolTrace[];
}

export const SUGGESTED_PROMPTS = [
  "Which tasks are overdue?",
  "Summarise the Payments Platform project",
  "What should I work on today?",
  "Who has the heaviest workload?",
  "Show critical bugs that are still open",
  "What is due this week?",
  "Create a task in OPS: rotate the staging database password, high priority",
  "How many tasks did we complete in the last 8 weeks?",
];

function formatTaskLine(t: CompactTask): string {
  const bits = [TASK_PRIORITY_LABELS[t.priority as TaskPriority].toLowerCase(), TASK_STATUS_LABELS[t.status as TaskStatus].toLowerCase()];
  if (t.assignee) bits.push(t.assignee);
  else bits.push("unassigned");
  if (t.dueDate) bits.push(`due ${t.dueDate}${t.overdue ? " (overdue)" : ""}`);
  return `- **${t.key}** ${t.title} — ${bits.join(" · ")}`;
}

function formatTaskList(tasks: CompactTask[], emptyText: string, max = 12): string {
  if (tasks.length === 0) return emptyText;
  const lines = tasks.slice(0, max).map(formatTaskLine);
  if (tasks.length > max) lines.push(`- …and ${tasks.length - max} more`);
  return lines.join("\n");
}

function helpText(): string {
  return [
    "I am the Fathom assistant. I answer from the live workspace data in SQL Server. Try:",
    ...SUGGESTED_PROMPTS.slice(0, 6).map((p) => `- ${p}`),
    "",
    "I can also look up a task by key (for example **PAY-7**) and create tasks when you ask me to.",
  ].join("\n");
}

/** Finds a project referenced by key or (partial) name in the text. */
async function detectProject(ctx: ToolContext, text: string): Promise<{ id: number; key: string; name: string } | null> {
  const projects = await projectsRepo.list(ctx.app.db);
  const lower = text.toLowerCase();
  const byKey = projects.find((p) => new RegExp(`\\b${p.key.toLowerCase()}\\b`).test(lower));
  if (byKey) return byKey;
  const byName = projects
    .filter((p) => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && new RegExp(`\\b${w}\\b`).test(lower)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  return byName ?? null;
}

async function detectPerson(ctx: ToolContext, text: string): Promise<string | null> {
  const users = await usersRepo.list(ctx.app.db);
  const lower = text.toLowerCase();
  const hit = users.find((u) => lower.includes(u.name.toLowerCase())) ?? users.find((u) => new RegExp(`\\b${u.name.split(" ")[0].toLowerCase()}\\b`).test(lower));
  return hit?.name ?? null;
}

function detectPriority(text: string): TaskPriority | undefined {
  if (/\b(critical|blocker|urgent|p0)\b/i.test(text)) return "critical";
  if (/\bhigh\b/i.test(text)) return "high";
  if (/\bmedium\b/i.test(text)) return "medium";
  if (/\blow\b/i.test(text)) return "low";
  return undefined;
}

function detectStatus(text: string): TaskStatus | undefined {
  if (/\bin[ -]review\b/i.test(text)) return "in_review";
  if (/\bin[ -]progress\b|\bongoing\b|\bworking on\b/i.test(text)) return "in_progress";
  if (/\bbacklog\b/i.test(text)) return "backlog";
  if (/\bto[ -]?do\b/i.test(text)) return "todo";
  if (/\b(done|completed|finished|closed)\b/i.test(text)) return "done";
  return undefined;
}

function parseCreateTask(text: string): { title: string; description?: string } | null {
  const quoted = /["“”']([^"“”']{3,})["“”']/.exec(text);
  if (quoted) return { title: quoted[1].trim() };
  const colon = /:\s*(.+)$/s.exec(text);
  if (colon) {
    const body = colon[1].trim();
    const [title, ...rest] = body.split(/\s*[.;]\s*|\s*,\s*(?=(?:high|low|medium|critical)\b)/i);
    const cleaned = title.replace(/\b(high|low|medium|critical)\s+priority\b/gi, "").replace(/\s{2,}/g, " ").trim();
    return cleaned.length >= 2 ? { title: cleaned, description: rest.join(". ").trim() || undefined } : null;
  }
  const called = /(?:called|titled|named)\s+(.+)$/i.exec(text);
  if (called) return { title: called[1].trim() };
  return null;
}

/**
 * Deterministic assistant used when no language model is configured (or the
 * model call fails). It recognises intents with keyword rules and answers
 * through the same tools the LLM would use, so every answer is grounded in
 * the database.
 */
export async function answerWithRules(message: string, ctx: ToolContext): Promise<BuiltinReply> {
  const text = message.trim();
  const lower = text.toLowerCase();
  const trace: AssistantToolTrace[] = [];

  const call = async (tool: string, args: Record<string, unknown>) => {
    const result = await runTool(tool, args, ctx);
    trace.push(result.trace);
    return result.data as Record<string, unknown> & { error?: string };
  };

  if (/^(hi|hello|hey|selam|merhaba|help|\?|what can you do|how can you help)\b/.test(lower) || lower.length < 3) {
    return { content: helpText(), trace };
  }

  // Explicit task keys win: "what's the status of PAY-7?"
  const keys = extractTaskKeys(text);
  if (keys.length > 0 && !/^(create|add|open|make)\b/.test(lower)) {
    const parts: string[] = [];
    for (const key of keys.slice(0, 3)) {
      const data = await call("get_task", { key });
      if (data.error) {
        parts.push(`I could not find **${key}**.`);
        continue;
      }
      const t = data as unknown as CompactTask & { description: string | null; reporter: string | null; comments: { author: string; body: string; at: string }[] };
      const lines = [
        `**${t.key} — ${t.title}**`,
        `- Project: ${t.project} · Status: ${TASK_STATUS_LABELS[t.status as TaskStatus]} · Priority: ${TASK_PRIORITY_LABELS[t.priority as TaskPriority]} · Type: ${t.type}`,
        `- Assignee: ${t.assignee ?? "unassigned"} · Reporter: ${t.reporter ?? "unknown"}${t.dueDate ? ` · Due: ${t.dueDate}${t.overdue ? " **(overdue)**" : ""}` : ""}${t.estimateHours ? ` · Estimate: ${t.estimateHours}h` : ""}`,
      ];
      if (t.labels.length) lines.push(`- Labels: ${t.labels.join(", ")}`);
      if (t.description) lines.push(`\n${t.description}`);
      if (t.comments.length) {
        lines.push("\nRecent comments:");
        for (const c of t.comments) lines.push(`- *${c.author}:* ${c.body}`);
      }
      parts.push(lines.join("\n"));
    }
    return { content: parts.join("\n\n"), trace };
  }

  // Create a task: "create a task in PAY: fix the webhook retry, high priority, assign to Zeynep"
  if (/^(please\s+)?(create|add|open|make|log)\b.*\b(task|ticket|issue|bug|todo)\b/.test(lower) || /\bnew (task|ticket|issue)\b/.test(lower)) {
    const project = await detectProject(ctx, text);
    const parsed = parseCreateTask(text);
    if (!project && !ctx.page?.projectId) {
      return { content: "Which project should the task go in? Tell me the project key (for example **PAY**) and the title, like:\n\n`Create a task in PAY: Fix webhook retries, high priority`", trace };
    }
    if (!parsed) {
      return { content: "What should the task be called? Put the title after a colon, for example:\n\n`Create a task in OPS: Rotate the staging database password`", trace };
    }
    const assignee = /\b(?:assign(?:ed)? to|for)\s+me\b/i.test(text) ? "me" : await detectPerson(ctx, text.replace(parsed.title, ""));
    const type = /\bbug\b/i.test(lower) ? "bug" : /\bresearch|spike|investigate\b/i.test(lower) ? "research" : /\bchore|maintenance\b/i.test(lower) ? "chore" : "feature";
    const dueMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
    const data = await call("create_task", {
      project: project?.key,
      title: parsed.title,
      description: parsed.description,
      priority: detectPriority(text.replace(parsed.title, "")) ?? "medium",
      type,
      assignee: assignee ?? undefined,
      dueDate: dueMatch?.[1],
    });
    if (data.error) return { content: `I could not create the task: ${data.error}`, trace };
    const task = (data as { task: CompactTask }).task;
    return {
      content: `Created **${task.key}** in ${task.project}: ${task.title}\n\n- Priority: ${TASK_PRIORITY_LABELS[task.priority as TaskPriority]} · Type: ${task.type} · Assignee: ${task.assignee ?? "unassigned"}${task.dueDate ? ` · Due: ${task.dueDate}` : ""}\n\nYou can open it from the board; I logged the creation in the activity feed.`,
      trace,
    };
  }

  const project = await detectProject(ctx, text);
  const mine = /\b(my|me|i|myself|mine)\b/.test(lower) && !/\bteam\b/.test(lower);

  if (/\b(overdue|late|past due|behind schedule|missed deadline|slipping)\b/.test(lower)) {
    const data = await call("search_tasks", { overdueOnly: true, project: project?.key, assignee: mine ? "me" : undefined, limit: 20 });
    const tasks = (data.tasks as CompactTask[] | undefined) ?? [];
    const scope = [project ? `in ${project.name}` : "", mine ? "assigned to you" : ""].filter(Boolean).join(" ");
    const header = tasks.length ? `**${tasks.length} overdue open task${tasks.length === 1 ? "" : "s"}** ${scope}`.trim() + ":" : `Nothing is overdue ${scope}. Nice.`.replace("  ", " ");
    const critical = tasks.filter((t) => t.priority === "critical").length;
    const footer = critical ? `\n\n${critical} of them ${critical === 1 ? "is" : "are"} critical — worth raising in stand-up.` : "";
    return { content: `${header}\n${formatTaskList(tasks, "")}${footer}`.trim(), trace };
  }

  if (/\b(due|deadline|upcoming|coming up)\b.*\b(today|tomorrow|this week|next week|soon|\d+ days?)\b|\b(today|tomorrow|this week|next week)\b.*\b(due|deadline)\b|\bwhat'?s due\b/.test(lower)) {
    const days = /\btoday\b/.test(lower) ? 0 : /\btomorrow\b/.test(lower) ? 1 : /\bnext week\b/.test(lower) ? 14 : /\b(\d+) days?\b/.exec(lower) ? Number(/\b(\d+) days?\b/.exec(lower)![1]) : 7;
    const data = await call("search_tasks", { dueWithinDays: days, project: project?.key, assignee: mine ? "me" : undefined, limit: 20 });
    const tasks = (data.tasks as CompactTask[] | undefined) ?? [];
    const label = days === 0 ? "today" : days === 1 ? "by tomorrow" : `within the next ${days} days`;
    return { content: `**${tasks.length} open task${tasks.length === 1 ? "" : "s"} due ${label}**${project ? ` in ${project.name}` : ""}${mine ? " for you" : ""}:\n${formatTaskList(tasks, "Nothing is due in that window.")}`, trace };
  }

  if (/\b(what should i (work on|do|pick up)|my (tasks|work|plate|queue|list)|assigned to me|what am i working on|my day|my focus)\b/.test(lower)) {
    const data = await call("search_tasks", { assignee: "me", openOnly: true, sort: "priority", limit: 30 });
    const tasks = (data.tasks as CompactTask[] | undefined) ?? [];
    if (tasks.length === 0) return { content: "You have no open tasks assigned. Ask a manager for work or pick something from a backlog.", trace };
    const overdue = tasks.filter((t) => t.overdue);
    const inProgress = tasks.filter((t) => t.status === "in_progress" && !t.overdue);
    const next = tasks.filter((t) => !t.overdue && t.status !== "in_progress");
    const sections = [
      `You have **${tasks.length} open task${tasks.length === 1 ? "" : "s"}**. Suggested order:`,
      overdue.length ? `\n**1. Overdue — clear these first**\n${formatTaskList(overdue, "")}` : "",
      inProgress.length ? `\n**${overdue.length ? 2 : 1}. Already in progress — finish before starting new work**\n${formatTaskList(inProgress, "")}` : "",
      next.length ? `\n**${(overdue.length ? 1 : 0) + (inProgress.length ? 1 : 0) + 1}. Next up, by priority and due date**\n${formatTaskList(next, "", 8)}` : "",
    ];
    return { content: sections.filter(Boolean).join("\n"), trace };
  }

  if (/\b(workload|busiest|capacity|bandwidth|overloaded|who has the most|who is free|idle|load balance|utili[sz]ation)\b/.test(lower)) {
    const data = await call("get_team_workload", {});
    const workload = (data.workload as { name: string; open: number; overdue: number; estimateHours: number }[] | undefined) ?? [];
    const idle = (data.noOpenTasks as string[] | undefined) ?? [];
    if (workload.length === 0) return { content: "Nobody has open tasks assigned right now.", trace };
    const lines = workload.map((w, i) => `${i + 1}. **${w.name}** — ${w.open} open${w.overdue ? `, ${w.overdue} overdue` : ""}${w.estimateHours ? `, ~${w.estimateHours}h estimated` : ""}`);
    const top = workload[0];
    const least = workload[workload.length - 1];
    const advice = workload.length > 1 && top.open - least.open >= 3 ? `\n\n${top.name} carries ${top.open - least.open} more open tasks than ${least.name}; consider rebalancing.` : "";
    return { content: `**Team workload (open tasks per person)**\n${lines.join("\n")}${idle.length ? `\n\nNo open tasks: ${idle.join(", ")}.` : ""}${advice}`, trace };
  }

  if (/\b(how many|count|total|number of|stats|statistics|numbers|throughput|velocity|completed (in|over|during)|last \d+ weeks?)\b/.test(lower) && !project) {
    const data = await call("get_team_workload", {});
    const totals = data.totals as Record<string, number>;
    const throughput = (data.throughput as { weekStart: string; created: number; completed: number }[] | undefined) ?? [];
    const byStatus = (data.byStatus as { status: TaskStatus; count: number }[] | undefined) ?? [];
    const completed8w = throughput.reduce((s, w) => s + w.completed, 0);
    const created8w = throughput.reduce((s, w) => s + w.created, 0);
    return {
      content: [
        "**Workspace numbers**",
        `- Projects: ${totals.projects} (${totals.activeProjects} active) · Members: ${totals.members}`,
        `- Tasks: ${totals.tasks} total, ${totals.openTasks} open, ${totals.overdue} overdue`,
        `- Last 7 days: ${totals.completedLast7Days} completed, ${totals.createdLast7Days} created`,
        `- Last 8 weeks: ${completed8w} completed vs ${created8w} created (${completed8w >= created8w ? "burning down" : "backlog growing"})`,
        `- By status: ${byStatus.map((s) => `${TASK_STATUS_LABELS[s.status]} ${s.count}`).join(" · ")}`,
      ].join("\n"),
      trace,
    };
  }

  if (project && /\b(summar\w*|status|health\w*|progress|overview|how is|how's|how are|update on|report\w*|risks?|doing|going)\b/.test(lower)) {
    const data = await call("get_project_summary", { project: project.key });
    if (data.error) return { content: data.error, trace };
    const s = data as unknown as {
      key: string; name: string; status: string; lead: string | null; targetDate: string | null; daysToTarget: number | null;
      totals: { tasks: number; done: number; open: number; percentDone: number; openEstimateHours: number };
      byStatus: Record<TaskStatus, number>; overdue: CompactTask[]; dueSoon: CompactTask[]; critical: CompactTask[]; inReview: CompactTask[];
      unassigned: number; workload: { name: string; open: number; overdue: number }[]; recentlyCompleted: CompactTask[];
    };
    const health = s.overdue.filter((t) => t.priority === "critical").length > 0 || s.overdue.length >= 3 ? "off track" : s.overdue.length > 0 || s.critical.length > 1 ? "at risk" : "on track";
    const lines = [
      `**${s.name} (${s.key}) — ${health}**`,
      `- ${s.totals.percentDone}% done: ${s.totals.done}/${s.totals.tasks} tasks, ${s.totals.open} open (~${s.totals.openEstimateHours}h estimated)${s.lead ? ` · Lead: ${s.lead}` : ""}${s.targetDate ? ` · Target: ${s.targetDate}${s.daysToTarget !== null ? ` (${s.daysToTarget >= 0 ? `${s.daysToTarget} days left` : `${-s.daysToTarget} days past`})` : ""}` : ""}`,
      `- Pipeline: backlog ${s.byStatus.backlog} · to do ${s.byStatus.todo} · in progress ${s.byStatus.in_progress} · in review ${s.byStatus.in_review} · done ${s.byStatus.done}`,
    ];
    const overdueKeys = new Set(s.overdue.map((t) => t.key));
    const criticalRest = s.critical.filter((t) => !overdueKeys.has(t.key));
    const listed = new Set([...overdueKeys, ...criticalRest.map((t) => t.key)]);
    const reviewRest = s.inReview.filter((t) => !listed.has(t.key));
    reviewRest.forEach((t) => listed.add(t.key));
    const dueRest = s.dueSoon.filter((t) => !listed.has(t.key));
    if (s.overdue.length) lines.push(`\n**Overdue (${s.overdue.length})**\n${formatTaskList(s.overdue, "", 6)}`);
    if (criticalRest.length) lines.push(`\n**Critical open items (${criticalRest.length})**\n${formatTaskList(criticalRest, "", 5)}`);
    else if (s.critical.length) lines.push("\nAll critical items are in the overdue list above.");
    if (reviewRest.length) lines.push(`\n**Waiting for review (${reviewRest.length})**\n${formatTaskList(reviewRest, "", 5)}`);
    if (dueRest.length) lines.push(`\n**Due in the next 7 days (${dueRest.length})**\n${formatTaskList(dueRest, "", 6)}`);
    if (s.unassigned) lines.push(`\n${s.unassigned} open task${s.unassigned === 1 ? " has" : "s have"} no assignee.`);
    if (s.recentlyCompleted.length) lines.push(`\nRecently completed: ${s.recentlyCompleted.slice(0, 3).map((t) => `**${t.key}** ${t.title}`).join("; ")}.`);
    return { content: lines.join("\n"), trace };
  }

  if (/\b(projects?)\b/.test(lower) && /\b(list|all|which|show|what|our|active|on hold|completed)\b/.test(lower) && !/\btasks?\b/.test(lower)) {
    const data = await call("list_projects", {});
    const projects = (data as unknown as { key: string; name: string; status: string; lead: string | null; tasks: number; done: number; overdue: number; targetDate: string | null }[]) ?? [];
    const lines = projects.map((p) => `- **${p.key}** ${p.name} — ${p.status.replace("_", " ")}, ${p.tasks ? Math.round((p.done / p.tasks) * 100) : 0}% done (${p.done}/${p.tasks})${p.overdue ? `, ${p.overdue} overdue` : ""}${p.lead ? ` · lead ${p.lead}` : ""}${p.targetDate ? ` · target ${p.targetDate}` : ""}`);
    return { content: `**${projects.length} projects**\n${lines.join("\n")}\n\nAsk me to summarise any of them.`, trace };
  }

  const person = mine ? "me" : await detectPerson(ctx, text);
  const priority = detectPriority(text);
  const status = detectStatus(text);
  const isBug = /\bbugs?\b/.test(lower);
  const wantsOpen = !status && !/\b(all|every|including done)\b/.test(lower);

  if (person || priority || status || isBug || project || /\b(find|search|show|list|tasks?|tickets?|issues?|about|related to)\b/.test(lower)) {
    const queryMatch = /\b(?:about|related to|regarding|mentioning|containing|on)\s+(.+?)(?:\s+in\s+[A-Z][A-Z0-9]{1,5}\b|\?|$)/i.exec(text);
    const quoted = /["“”]([^"“”]+)["“”]/.exec(text);
    const query = quoted?.[1] ?? queryMatch?.[1]?.trim();
    const data = await call("search_tasks", {
      query,
      project: project?.key,
      assignee: person ?? undefined,
      priority,
      status,
      type: isBug ? "bug" : undefined,
      openOnly: wantsOpen,
      sort: status === "done" ? "updated" : "priority",
      limit: 20,
    });
    if (data.error) return { content: data.error, trace };
    const tasks = (data.tasks as CompactTask[] | undefined) ?? [];
    const total = Number(data.total ?? tasks.length);
    const scope = [
      isBug ? (total === 1 ? "bug" : "bugs") : total === 1 ? "task" : "tasks",
      priority ? `with ${priority} priority` : "",
      status ? `in ${TASK_STATUS_LABELS[status].toLowerCase()}` : wantsOpen ? "(open)" : "",
      query ? `matching "${query}"` : "",
      project ? `in ${project.name}` : "",
      person ? (person === "me" ? "assigned to you" : `assigned to ${person}`) : "",
    ].filter(Boolean).join(" ");
    return { content: `**${total} ${scope}**\n${formatTaskList(tasks, "No tasks match that.")}`, trace };
  }

  return {
    content: `I am not sure what you are asking. ${helpText()}`,
    trace,
  };
}
