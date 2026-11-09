import type { BreakdownResponse, BreakdownSuggestion, Project } from "@stratum/shared";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { extractJson, type LlmClient } from "./llm.js";

const suggestionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).default(""),
  type: z.enum(["feature", "bug", "chore", "research"]).default("feature"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  estimateHours: z.coerce.number().min(0.5).max(200).default(4),
  labels: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
});

const responseSchema = z.object({ tasks: z.array(suggestionSchema).min(1).max(12) });

type Flavour = "bug" | "data" | "integration" | "ui" | "performance" | "security" | "generic";

export function detectFlavour(goal: string): Flavour {
  const g = goal.toLowerCase();
  if (/\b(bug|crash|broken|fails?|error|incorrect|regression|fix)\b/.test(g)) return "bug";
  if (/\b(migrat|database|sql|schema|table|warehouse|etl|elt|report(ing)?|data model)\b/.test(g)) return "data";
  if (/\b(api|integrat|webhook|provider|third[- ]party|sdk|sync|import|export)\b/.test(g)) return "integration";
  if (/\b(ui|ux|page|screen|form|design|dashboard|frontend|component|onboarding|layout|mobile)\b/.test(g)) return "ui";
  if (/\b(performance|slow|latency|load|scale|cache|optimi[sz]e|throughput)\b/.test(g)) return "performance";
  if (/\b(security|auth|login|password|permission|role|encrypt|gdpr|kvkk|compliance|audit)\b/.test(g)) return "security";
  return "generic";
}

function shorten(goal: string, max = 60): string {
  const clean = goal.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  const lowered = clean.charAt(0).toLowerCase() + clean.slice(1);
  if (lowered.length <= max) return lowered;
  const cut = lowered.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 30)).trimEnd()}…`;
}

/** Deterministic breakdown used when no model is configured. */
export function heuristicBreakdown(goal: string, maxTasks: number): BreakdownSuggestion[] {
  const topic = shorten(goal);
  const flavour = detectFlavour(goal);
  const big = /\b(platform|rewrite|rebuild|migration|end[- ]to[- ]end|multi|entire|whole|all)\b/i.test(goal);
  const scale = big ? 1.6 : 1;
  const h = (hours: number) => Math.round(hours * scale * 2) / 2;

  const templates: Record<Flavour, BreakdownSuggestion[]> = {
    bug: [
      { title: `Reproduce and capture evidence: ${topic}`, description: "Write exact reproduction steps, collect logs/screenshots and identify the affected versions and environments.", type: "research", priority: "high", estimateHours: h(2), labels: ["investigation"] },
      { title: `Root-cause analysis for ${topic}`, description: "Trace the failure to the responsible component, note contributing factors and decide on the fix strategy.", type: "research", priority: "high", estimateHours: h(3), labels: ["investigation"] },
      { title: `Implement the fix: ${topic}`, description: "Apply the smallest safe change, keep the behaviour backwards compatible and add inline reasoning where non-obvious.", type: "bug", priority: "high", estimateHours: h(4), labels: ["bug"] },
      { title: "Add a regression test covering the failure", description: "An automated test that fails before the fix and passes after it, at the lowest practical level (unit or integration).", type: "chore", priority: "medium", estimateHours: h(2), labels: ["qa"] },
      { title: "Verify on staging and monitor after release", description: "Confirm the fix on staging with the original reproduction, then watch error rates for 24h in production.", type: "chore", priority: "medium", estimateHours: h(1.5), labels: ["release"] },
      { title: "Write a short incident/post-mortem note", description: "What broke, why, how it was caught, and the follow-ups that prevent recurrence.", type: "chore", priority: "low", estimateHours: h(1), labels: ["docs"] },
    ],
    data: [
      { title: `Requirements and data model: ${topic}`, description: "Agree the entities, grain, keys, retention and reporting questions this must answer.", type: "research", priority: "high", estimateHours: h(4), labels: ["data-model"] },
      { title: "Write the SQL Server schema migration", description: "Tables, constraints, indexes and views as idempotent migration scripts with rollback notes.", type: "feature", priority: "high", estimateHours: h(6), labels: ["sql-server", "migration"] },
      { title: "Backfill and validate historical data", description: "Load existing data, reconcile counts and totals against the source of truth, document discrepancies.", type: "feature", priority: "medium", estimateHours: h(6), labels: ["pipeline"] },
      { title: "Update application queries and repositories", description: "Point the application code at the new structures with parameterised queries and transactions where needed.", type: "feature", priority: "medium", estimateHours: h(6), labels: ["backend"] },
      { title: "Performance pass: indexes and execution plans", description: "Review the slowest queries with actual execution plans; add covering/filtered indexes where justified.", type: "chore", priority: "medium", estimateHours: h(3), labels: ["performance", "sql-server"] },
      { title: "Automated data-quality checks", description: "Row counts, null ratios and referential checks that run after each load and alert on drift.", type: "chore", priority: "low", estimateHours: h(3), labels: ["qa"] },
    ],
    integration: [
      { title: `Define the contract for ${topic}`, description: "Endpoints/events, payloads, authentication, idempotency, retries and error semantics agreed with the other side.", type: "research", priority: "high", estimateHours: h(3), labels: ["architecture"] },
      { title: "Implement the adapter with a provider interface", description: "Isolate third-party specifics behind an interface so it can be swapped or mocked.", type: "feature", priority: "high", estimateHours: h(8), labels: ["backend"] },
      { title: "Handle failures: retries, timeouts, dead-letter", description: "Exponential backoff, circuit breaking and a dead-letter path with alerting for poison messages.", type: "feature", priority: "medium", estimateHours: h(5), labels: ["reliability"] },
      { title: "Contract and integration tests against a sandbox", description: "Record/replay or sandbox tests that cover success, validation errors and provider outages.", type: "chore", priority: "medium", estimateHours: h(4), labels: ["qa"] },
      { title: "Secrets, configuration and environment wiring", description: "Store credentials securely, add per-environment configuration and health checks.", type: "chore", priority: "medium", estimateHours: h(2), labels: ["devops"] },
      { title: "Observability: logs, metrics and dashboard", description: "Structured logs with correlation ids, success/failure counters and latency histograms on a dashboard.", type: "chore", priority: "low", estimateHours: h(3), labels: ["observability"] },
    ],
    ui: [
      { title: `User flow and wireframes for ${topic}`, description: "Map the states (empty, loading, error, success) and get sign-off on low-fidelity wireframes.", type: "research", priority: "high", estimateHours: h(4), labels: ["design"] },
      { title: "High-fidelity design and component spec", description: "Final visuals in the design system, responsive breakpoints and interaction details.", type: "feature", priority: "medium", estimateHours: h(6), labels: ["design"] },
      { title: "Build the UI components and page", description: "Implement with the shared component library, form validation and optimistic updates where it helps.", type: "feature", priority: "high", estimateHours: h(10), labels: ["frontend"] },
      { title: "Wire the UI to the API and handle edge cases", description: "Loading skeletons, error toasts, retry, pagination and permission-aware controls.", type: "feature", priority: "medium", estimateHours: h(5), labels: ["frontend"] },
      { title: "Accessibility and responsive QA", description: "Keyboard navigation, labels, contrast, screen-reader pass and mobile layouts.", type: "chore", priority: "medium", estimateHours: h(3), labels: ["a11y", "qa"] },
      { title: "Component tests and an end-to-end happy path", description: "Unit tests for logic-heavy components plus one browser test covering the main flow.", type: "chore", priority: "low", estimateHours: h(3), labels: ["qa"] },
    ],
    performance: [
      { title: `Measure a baseline for ${topic}`, description: "Define the target metric (p95 latency, throughput, memory) and capture current numbers in a repeatable way.", type: "research", priority: "high", estimateHours: h(3), labels: ["performance"] },
      { title: "Profile and identify the top hotspots", description: "Use profiling/execution plans to find the 2–3 biggest contributors; write them up with evidence.", type: "research", priority: "high", estimateHours: h(4), labels: ["performance"] },
      { title: "Optimise the largest hotspot", description: "Apply the fix (query/index, caching, algorithmic change) behind a feature flag if risky.", type: "feature", priority: "high", estimateHours: h(8), labels: ["performance"] },
      { title: "Add caching or batching where it pays off", description: "Introduce cache layers or request batching with clear invalidation rules.", type: "feature", priority: "medium", estimateHours: h(5), labels: ["performance"] },
      { title: "Load test and compare against the baseline", description: "Automated load test reproducing production traffic shape; publish before/after numbers.", type: "chore", priority: "medium", estimateHours: h(4), labels: ["qa", "performance"] },
      { title: "Alerting on performance regressions", description: "Dashboards and alerts on the target metric so regressions are caught before users notice.", type: "chore", priority: "low", estimateHours: h(2), labels: ["observability"] },
    ],
    security: [
      { title: `Threat model for ${topic}`, description: "Assets, actors, entry points and the abuse cases to defend against; decide mitigations.", type: "research", priority: "high", estimateHours: h(3), labels: ["security"] },
      { title: "Implement the control", description: "Build the authentication/authorisation/encryption change with secure defaults and no bypass paths.", type: "feature", priority: "critical", estimateHours: h(8), labels: ["security", "backend"] },
      { title: "Audit logging for sensitive actions", description: "Record who did what and when, tamper-evident, and surface it in the activity feed.", type: "feature", priority: "medium", estimateHours: h(4), labels: ["security", "audit"] },
      { title: "Negative tests and abuse-case tests", description: "Automated tests proving unauthorised paths fail closed, including token replay and privilege escalation attempts.", type: "chore", priority: "high", estimateHours: h(4), labels: ["qa", "security"] },
      { title: "Dependency and configuration review", description: "Scan dependencies, review headers/CORS/cookies and rotate any affected secrets.", type: "chore", priority: "medium", estimateHours: h(2), labels: ["security"] },
      { title: "Document the change for compliance", description: "Short write-up for the security/compliance record with evidence of testing.", type: "chore", priority: "low", estimateHours: h(1.5), labels: ["docs", "compliance"] },
    ],
    generic: [
      { title: `Clarify scope and acceptance criteria: ${topic}`, description: "Write the user stories, acceptance criteria, non-goals and open questions; review with stakeholders.", type: "research", priority: "high", estimateHours: h(3), labels: ["planning"] },
      { title: "Technical design and task plan", description: "Decide the approach, affected components, data changes and rollout strategy; capture it in a short design note.", type: "research", priority: "high", estimateHours: h(4), labels: ["architecture"] },
      { title: `Implement the core of ${topic}`, description: "Build the main functionality end to end on a feature branch with small, reviewable commits.", type: "feature", priority: "high", estimateHours: h(12), labels: ["implementation"] },
      { title: "Edge cases, validation and error handling", description: "Cover the unhappy paths identified in the acceptance criteria and make failures understandable to users.", type: "feature", priority: "medium", estimateHours: h(5), labels: ["implementation"] },
      { title: "Automated tests", description: "Unit tests for the logic plus an integration/end-to-end test for the primary flow.", type: "chore", priority: "medium", estimateHours: h(5), labels: ["qa"] },
      { title: "Documentation, demo and release", description: "Update docs/changelog, record a short demo, roll out behind a flag and monitor.", type: "chore", priority: "low", estimateHours: h(2), labels: ["release", "docs"] },
    ],
  };

  return templates[flavour].slice(0, maxTasks);
}

export async function generateBreakdown(
  llm: LlmClient | null,
  project: Project,
  goal: string,
  maxTasks: number,
): Promise<BreakdownResponse> {
  if (!llm) return { source: "builtin", suggestions: heuristicBreakdown(goal, maxTasks) };
  try {
    const completion = await llm.complete(
      [
        {
          role: "system",
          content: [
            "You are a senior engineering lead who splits goals into well-scoped, independently deliverable tasks.",
            `Return ONLY JSON of the form {"tasks":[{"title","description","type","priority","estimateHours","labels"}]} with ${Math.min(maxTasks, 12)} or fewer tasks.`,
            "type ∈ feature|bug|chore|research; priority ∈ low|medium|high|critical; estimateHours is a number (0.5–200); labels is an array of up to 3 short lowercase tags.",
            "Titles are imperative and specific (max 100 chars); descriptions state the outcome and acceptance criteria in 1–3 sentences. Include testing and rollout work. No markdown.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Project: ${project.name} (${project.key})${project.description ? ` — ${project.description}` : ""}\n\nGoal: ${goal}`,
        },
      ],
      { jsonMode: true, temperature: 0.4, maxTokens: 1800 },
    );
    const parsed = responseSchema.safeParse(extractJson(completion.content));
    if (!parsed.success) throw new Error("Model returned an unexpected breakdown shape");
    return { source: "llm", suggestions: parsed.data.tasks.slice(0, maxTasks) };
  } catch (err) {
    logger.warn({ err }, "LLM breakdown failed; using heuristic breakdown");
    return { source: "builtin", suggestions: heuristicBreakdown(goal, maxTasks) };
  }
}
