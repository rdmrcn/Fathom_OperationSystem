import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), toast.tone === "error" ? 6000 : 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ tone: "success", title, description }),
  error: (title: string, description?: string) => useToastStore.getState().push({ tone: "error", title, description }),
  info: (title: string, description?: string) => useToastStore.getState().push({ tone: "info", title, description }),
};

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const colors = { success: "text-emerald-500", error: "text-rose-500", info: "text-sky-500" };

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div key={t.id} className="card pointer-events-auto flex items-start gap-3 p-3.5 animate-slide-up">
            <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", colors[t.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-subtle hover:text-fg" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
