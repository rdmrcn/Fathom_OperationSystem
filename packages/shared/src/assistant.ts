import { z } from "zod";
import type { IsoDate } from "./models.js";

export type AssistantSource = "llm" | "builtin";

export interface AssistantToolTrace {
  /** Tool name, e.g. `search_tasks` or `run_report_query`. */
  tool: string;
  /** Short human-readable description of the call, e.g. the SQL that ran. */
  summary: string;
  /** Number of rows/items returned, when applicable. */
  resultCount?: number;
  durationMs?: number;
}

export interface AssistantMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  source: AssistantSource | null;
  toolTrace: AssistantToolTrace[];
  createdAt: IsoDate;
}

export interface Conversation {
  id: number;
  title: string;
  messageCount: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface ConversationDetail extends Conversation {
  messages: AssistantMessage[];
}

export interface ChatResponse {
  conversation: Conversation;
  userMessage: AssistantMessage;
  assistantMessage: AssistantMessage;
}

export const chatRequestSchema = z.object({
  conversationId: z.number().int().positive().nullable().optional(),
  message: z.string().trim().min(1, "Write a message").max(2000),
  /** Optional page context so the assistant can scope answers (e.g. the open project). */
  context: z
    .object({
      projectId: z.number().int().positive().optional(),
      taskId: z.number().int().positive().optional(),
    })
    .optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const breakdownRequestSchema = z.object({
  projectId: z.number().int().positive(),
  goal: z.string().trim().min(10, "Describe the goal in a sentence or two").max(2000),
  maxTasks: z.number().int().min(2).max(12).default(6),
});
export type BreakdownRequest = z.infer<typeof breakdownRequestSchema>;

export interface BreakdownSuggestion {
  title: string;
  description: string;
  type: "feature" | "bug" | "chore" | "research";
  priority: "low" | "medium" | "high" | "critical";
  estimateHours: number;
  labels: string[];
}

export interface BreakdownResponse {
  source: AssistantSource;
  suggestions: BreakdownSuggestion[];
}

export const applyBreakdownSchema = z.object({
  projectId: z.number().int().positive(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().max(5000).default(""),
        type: z.enum(["feature", "bug", "chore", "research"]).default("feature"),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        estimateHours: z.number().min(0).max(1000).nullable().optional(),
        labels: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
      }),
    )
    .min(1)
    .max(12),
});
export type ApplyBreakdownInput = z.infer<typeof applyBreakdownSchema>;

export interface ProjectSummaryResponse {
  source: AssistantSource;
  /** Markdown. */
  summary: string;
  health: "on_track" | "at_risk" | "off_track";
  highlights: string[];
  risks: string[];
}

export interface AssistantCapabilities {
  llmEnabled: boolean;
  model: string | null;
  tools: { name: string; description: string }[];
  suggestedPrompts: string[];
}
