import type { Project, ProjectSummaryResponse, TaskStatus } from "@stratum/shared";
import { logger } from "../../lib/logger.js";
import type { LlmClient } from "./llm.js";
import { projectSummaryTool, type CompactTask, type ToolContext } from "./tools.js";

export interface SummaryData {
  key: string;
  name: string;
  status: string;
  lead: string | null;
  targetDate: string | null;
  daysToTarget: number | null;
  totals: { tasks: number; done: number; open: number; percentDone: number; openEstimateHours: number };
  byStatus: Record<TaskStatus, number>;
  overdue: CompactTask[];
  dueSoon: CompactTask[];
  critical: CompactTask[];
  inReview: CompactTask[];
  unassigned: number;
  workload: { name: string; open: number; overdue: number }[];
  recentlyCompleted: CompactTask[];
}

export function assessHealth(data: SummaryData): Pick<ProjectSummaryResponse, "health" | "highlights" | "risks"> {
  const risks: string[] = [];
  const highlights: string[] = [];
  const criticalOverdue = data.overdue.filter((t) => t.priority === "critical");

  if (criticalOverdue.length) risks.push(`${criticalOverdue.length} critical task${criticalOverdue.length === 1 ? " is" : "s are"} overdue (${criticalOverdue.map((t) => t.key).join(", ")})`);
  else if (data.overdue.length) risks.push(`${data.overdue.length} overdue task${data.overdue.length === 1 ? "" : "s"} (${data.overdue.slice(0, 3).map((t) => t.key).join(", ")})`);
  if (data.critical.length > 1) risks.push(`${data.critical.length} open critical items compete for attention`);
  if (data.unassigned >= 3) risks.push(`${data.unassigned} open tasks have no owner`);
  if (data.inReview.length >= 3) risks.push(`${data.inReview.length} tasks are waiting in review — a review bottleneck`);
  const heavy = data.workload.filter((w) => w.open >= 5);
  if (heavy.length) risks.push(`${heavy.map((w) => w.name).join(" and ")} ${heavy.length === 1 ? "carries" : "carry"} 5+ open tasks`);
  if (data.daysToTarget !== null && data.daysToTarget >= 0 && data.totals.open > 0) {
    const hoursPerDay = data.totals.openEstimateHours / Math.max(1, data.daysToTarget);
    const people = Math.max(1, data.workload.filter((w) => w.open > 0).length);
    if (hoursPerDay / people > 6) risks.push(`~${Math.round(data.totals.openEstimateHours)}h of open work for ${data.daysToTarget} days left looks tight for ${people} people`);
  }
  if (data.daysToTarget !== null && data.daysToTarget < 0 && data.totals.open > 0) risks.push(`Target date passed ${-data.daysToTarget} days ago with ${data.totals.open} tasks still open`);

  if (data.totals.percentDone >= 50) highlights.push(`${data.totals.percentDone}% of tasks are done`);
  if (data.recentlyCompleted.length) highlights.push(`Recently completed: ${data.recentlyCompleted.slice(0, 3).map((t) => t.key).join(", ")}`);
  if (data.byStatus.in_progress > 0) highlights.push(`${data.byStatus.in_progress} task${data.byStatus.in_progress === 1 ? "" : "s"} actively in progress`);
  if (data.overdue.length === 0) highlights.push("Nothing is overdue");
  if (data.dueSoon.length) highlights.push(`${data.dueSoon.length} task${data.dueSoon.length === 1 ? "" : "s"} due in the next 7 days`);

  const health: ProjectSummaryResponse["health"] =
    criticalOverdue.length > 0 || data.overdue.length >= 3 || (data.daysToTarget !== null && data.daysToTarget < 0 && data.totals.open > 0)
      ? "off_track"
      : risks.length > 0
        ? "at_risk"
        : "on_track";
  return { health, highlights, risks };
}

function builtinSummary(data: SummaryData, assessment: ReturnType<typeof assessHealth>): string {
  const label = { on_track: "On track", at_risk: "At risk", off_track: "Off track" }[assessment.health];
  const lines = [
    `**${data.name}** is **${label.toLowerCase()}** — ${data.totals.done} of ${data.totals.tasks} tasks done (${data.totals.percentDone}%), ${data.totals.open} open with ~${Math.round(data.totals.openEstimateHours)}h estimated${data.targetDate ? `, target ${data.targetDate}${data.daysToTarget !== null ? ` (${data.daysToTarget >= 0 ? `${data.daysToTarget} days left` : `${-data.daysToTarget} days past`})` : ""}` : ""}.`,
    "",
    `Pipeline: backlog ${data.byStatus.backlog} · to do ${data.byStatus.todo} · in progress ${data.byStatus.in_progress} · in review ${data.byStatus.in_review} · done ${data.byStatus.done}.`,
  ];
  if (assessment.risks.length) {
    lines.push("", "**Risks**");
    for (const r of assessment.risks) lines.push(`- ${r}`);
  }
  if (assessment.highlights.length) {
    lines.push("", "**Highlights**");
    for (const h of assessment.highlights) lines.push(`- ${h}`);
  }
  if (data.overdue.length) {
    lines.push("", "**Overdue**");
    for (const t of data.overdue.slice(0, 5)) lines.push(`- **${t.key}** ${t.title} (${t.priority}, ${t.assignee ?? "unassigned"}, due ${t.dueDate})`);
  }
  const next: string[] = [];
  if (data.overdue.length) next.push(`clear the overdue items, starting with ${data.overdue[0].key}`);
  if (data.inReview.length >= 3) next.push("unblock the review queue");
  if (data.unassigned) next.push(`assign the ${data.unassigned} ownerless task${data.unassigned === 1 ? "" : "s"}`);
  if (next.length) lines.push("", `Suggested next step: ${next.join("; ")}.`);
  return lines.join("\n");
}

export async function summarizeProject(llm: LlmClient | null, project: Project, ctx: ToolContext): Promise<ProjectSummaryResponse> {
  const result = await projectSummaryTool.run({ project: project.key }, ctx);
  const data = result.data as SummaryData;
  const assessment = assessHealth(data);

  if (llm) {
    try {
      const completion = await llm.complete(
        [
          {
            role: "system",
            content:
              "You write crisp project status updates for engineering managers. Use ONLY the JSON facts provided; never invent. Output Markdown (bold, '-' bullets, no headings), 120–200 words: one-line verdict, 2–4 risks with task keys, 2–3 highlights, and one concrete next step. Mention people by name where relevant.",
          },
          { role: "user", content: `Health assessment: ${assessment.health}\nFACTS:\n${JSON.stringify(data).slice(0, 14_000)}` },
        ],
        { temperature: 0.3, maxTokens: 600 },
      );
      const text = completion.content?.trim();
      if (text) return { source: "llm", summary: text, ...assessment };
    } catch (err) {
      logger.warn({ err }, "LLM summary failed; using built-in summary");
    }
  }
  return { source: "builtin", summary: builtinSummary(data, assessment), ...assessment };
}
