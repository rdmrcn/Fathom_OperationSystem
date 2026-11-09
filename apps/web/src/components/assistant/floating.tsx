import type { AssistantMessage } from "@stratum/shared";
import { Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { useAssistantCapabilities, useConversation, useSendMessage } from "@/lib/queries";
import { nextTempId } from "@/lib/temp-id";
import { useUiStore } from "@/store/ui";
import { ChatThread } from "./chat-thread";
import { Composer } from "./composer";

export function FloatingAssistant() {
  const open = useUiStore((s) => s.assistantOpen);
  const setOpen = useUiStore((s) => s.setAssistantOpen);
  const location = useLocation();
  const projectId = /^\/projects\/(\d+)/.exec(location.pathname)?.[1];
  const caps = useAssistantCapabilities();
  const send = useSendMessage();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const conversation = useConversation(conversationId);
  const [optimistic, setOptimistic] = useState<AssistantMessage[]>([]);

  const messages = useMemo(() => {
    const server = conversation.data?.messages ?? [];
    return [...server, ...optimistic.filter((m) => !server.some((s) => s.content === m.content && s.role === m.role))];
  }, [conversation.data, optimistic]);

  if (location.pathname.startsWith("/assistant")) return null;

  async function onSend(text: string) {
    const temp: AssistantMessage = {
      id: nextTempId(),
      conversationId: conversationId ?? 0,
      role: "user",
      content: text,
      source: null,
      toolTrace: [],
      createdAt: new Date().toISOString(),
    };
    setOptimistic((m) => [...m, temp]);
    try {
      const res = await send.mutateAsync({
        conversationId,
        message: text,
        context: projectId ? { projectId: Number(projectId) } : undefined,
      });
      setConversationId(res.conversation.id);
      setOptimistic([]);
    } catch (err) {
      setOptimistic([]);
      toast.error("Assistant failed", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-accent px-4 font-medium text-accent-fg shadow-lg hover:brightness-110 sm:hidden"
        >
          <Sparkles className="h-4 w-4" />
          Ask AI
        </button>
      )}
      {open && (
        <div className="card fixed bottom-5 right-5 z-40 flex h-[min(640px,calc(100svh-6rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden shadow-2xl">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Fathom</p>
              <p className="text-[11px] text-subtle">
                {caps.data?.llmEnabled ? `Model: ${caps.data.model}` : "Built-in engine · live SQL Server data"}
                {projectId && " · this project"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X className="h-4 w-4" />
            </Button>
          </header>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !send.isPending ? (
              <div className="space-y-2">
                <p className="text-sm text-muted">Ask in plain English (or Turkish). Try:</p>
                {(caps.data?.suggestedPrompts ?? []).slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void onSend(p)}
                    className="block w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:border-accent"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <ChatThread messages={messages} pending={send.isPending} />
            )}
          </div>
          <div className="border-t border-border p-3">
            <Composer onSend={(m) => void onSend(m)} disabled={send.isPending} />
          </div>
        </div>
      )}
    </>
  );
}
