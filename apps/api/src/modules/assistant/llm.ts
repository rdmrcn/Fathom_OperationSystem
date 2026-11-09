import type { Env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LlmCompletion {
  content: string | null;
  toolCalls: LlmToolCall[];
  finishReason: string | null;
}

export interface LlmClient {
  readonly model: string;
  complete(
    messages: LlmMessage[],
    options?: { tools?: LlmToolDefinition[]; temperature?: number; maxTokens?: number; jsonMode?: boolean },
  ): Promise<LlmCompletion>;
}

/**
 * Minimal client for any OpenAI-compatible `/chat/completions` endpoint
 * (OpenAI, Azure OpenAI via proxy, Groq, Ollama, LM Studio, OpenRouter...).
 * The assistant works without it: when no key is configured the built-in
 * engine answers from the same data tools.
 */
export class OpenAiCompatibleClient implements LlmClient {
  constructor(
    private readonly config: { apiKey: string; baseUrl: string; model: string; timeoutMs: number },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get model(): string {
    return this.config.model;
  }

  async complete(
    messages: LlmMessage[],
    options: { tools?: LlmToolDefinition[]; temperature?: number; maxTokens?: number; jsonMode?: boolean } = {},
  ): Promise<LlmCompletion> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 900,
    };
    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
      body.tool_choice = "auto";
    }
    if (options.jsonMode) body.response_format = { type: "json_object" };

    const started = Date.now();
    const response = await this.fetchImpl(`${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 300)}`);
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    logger.debug({ ms: Date.now() - started, finish: choice?.finish_reason }, "LLM completion");
    return {
      content: choice?.message?.content ?? null,
      toolCalls: choice?.message?.tool_calls ?? [],
      finishReason: choice?.finish_reason ?? null,
    };
  }
}

export function getLlmClient(env: Env, fetchImpl?: typeof fetch): LlmClient | null {
  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAiCompatibleClient({ apiKey, baseUrl: env.AI_BASE_URL, model: env.AI_MODEL, timeoutMs: env.AI_TIMEOUT_MS }, fetchImpl);
}

/** Extracts the first JSON object from a model reply that may contain prose or code fences. */
export function extractJson(text: string | null): unknown {
  if (!text) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
