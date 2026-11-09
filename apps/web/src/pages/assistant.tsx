import type { AssistantMessage } from "@stratum/shared";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ChatThread } from "@/components/assistant/chat-thread";
import { Composer } from "@/components/assistant/composer";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { useAssistantCapabilities, useConversation, useConversations, useDeleteConversation, useSendMessage } from "@/lib/queries";
import { nextTempId } from "@/lib/temp-id";
import { cn, timeAgo } from "@/lib/utils";

export function AssistantPage() {
  const caps = useAssistantCapabilities();
  const list = useConversations();
  const remove = useDeleteConversation();
  const send = useSendMessage();
  const [id, setId] = useState<number | null>(null);
  const conversation = useConversation(id);
  const [optimistic, setOptimistic] = useState<AssistantMessage[]>([]);

  const messages = useMemo(() => {
    const server = conversation.data?.messages ?? [];
    return [...server, ...optimistic.filter((m) => !server.some((s) => s.content === m.content && s.role === m.role))];
  }, [conversation.data, optimistic]);

  async function onSend(text: string) {
    const temp: AssistantMessage = {
      id: nextTempId(),
      conversationId: id ?? 0,
      role: "user",
      content: text,
      source: null,
      toolTrace: [],
      createdAt: new Date().toISOString(),
    };
    setOptimistic((m) => [...m, temp]);
    try {
      const res = await send.mutateAsync({ conversationId: id, message: text });
      setId(res.conversation.id);
      setOptimistic([]);
    } catch (err) {
      setOptimistic([]);
      toast.error("Assistant failed", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  return (
    <>
      <PageHeader
        title="Assistant"
        description={
          caps.data?.llmEnabled
            ? `Talking through ${caps.data.model}. Tools still run against SQL Server; the model only phrases the answer.`
            : "No API key configured — the built-in engine answers from live SQL Server data. Set AI_API_KEY to enable a language model."
        }
        actions={
          <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => { setId(null); setOptimistic([]); }}>
            New chat
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="card max-h-[70vh] overflow-y-auto p-2">
          {(list.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setId(c.id); setOptimistic([]); }}
              className={cn("flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2", id === c.id && "bg-accent-soft text-accent")}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.title}</span>
                <span className="text-[11px] text-subtle">{timeAgo(c.updatedAt)} · {c.messageCount} msgs</span>
              </span>
              <span
                role="button"
                tabIndex={0}
                className="text-subtle hover:text-rose-500"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove.mutateAsync(c.id).then(() => {
                    if (id === c.id) setId(null);
                  });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
          {(list.data ?? []).length === 0 && <p className="px-3 py-6 text-center text-xs text-muted">No saved conversations yet.</p>}
        </aside>
        <section className="card flex min-h-[60vh] flex-col">
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
            {messages.length === 0 && !send.isPending ? (
              <EmptyState
                title="Ask the workspace"
                description="Overdue work, project health, workload, task keys like PAY-7, or “create a task in OPS: …”"
                action={
                  <div className="flex max-w-md flex-wrap justify-center gap-2">
                    {(caps.data?.suggestedPrompts ?? []).map((p) => (
                      <button key={p} type="button" onClick={() => void onSend(p)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent">
                        {p}
                      </button>
                    ))}
                  </div>
                }
              />
            ) : (
              <ChatThread messages={messages} pending={send.isPending} />
            )}
          </div>
          <div className="border-t border-border p-4">
            <Composer onSend={(m) => void onSend(m)} disabled={send.isPending} />
          </div>
        </section>
      </div>
    </>
  );
}
