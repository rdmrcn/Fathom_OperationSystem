import type { AssistantMessage, AssistantToolTrace } from "@stratum/shared";
import { Sparkles, User } from "lucide-react";
import { Markdown } from "./markdown";
import { cn, timeAgo } from "@/lib/utils";

export function ChatThread({ messages, pending }: { messages: AssistantMessage[]; pending?: boolean }) {
  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {pending && (
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="card px-4 py-3">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const mine = message.role === "user";
  return (
    <div className={cn("flex items-start gap-3", mine && "flex-row-reverse")}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", mine ? "bg-surface-2 text-muted" : "bg-accent-soft text-accent")}>
        {mine ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </span>
      <div className={cn("max-w-[min(100%,42rem)]", mine ? "text-right" : "")}>
        <div className={cn("rounded-2xl px-4 py-3 text-left", mine ? "bg-accent text-accent-fg" : "card")}>
          {mine ? <p className="whitespace-pre-wrap text-sm">{message.content}</p> : <Markdown text={message.content} />}
        </div>
        <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-[11px] text-subtle", mine && "justify-end")}>
          <span>{timeAgo(message.createdAt)}</span>
          {message.source && <span>· {message.source === "llm" ? "language model" : "built-in engine"}</span>}
        </div>
        {!mine && message.toolTrace.length > 0 && <ToolTrace traces={message.toolTrace} />}
      </div>
    </div>
  );
}

function ToolTrace({ traces }: { traces: AssistantToolTrace[] }) {
  return (
    <details className="mt-1.5 text-left">
      <summary className="cursor-pointer text-[11px] text-subtle hover:text-muted">Used {traces.length} tool{traces.length === 1 ? "" : "s"}</summary>
      <ul className="mt-1 space-y-1 rounded-xl bg-surface-2 px-3 py-2 font-mono text-[11px] text-muted">
        {traces.map((t, i) => (
          <li key={`${t.tool}-${i}`}>
            <span className="text-accent">{t.tool}</span>
            {t.resultCount != null && ` · ${t.resultCount} rows`}
            {t.durationMs != null && ` · ${t.durationMs}ms`}
            <div className="truncate text-subtle">{t.summary}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}
