import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useT } from "@/i18n";
import { GOTO_PATHS } from "@/lib/commands";
import { Kbd } from "@/components/ui/primitives";

export function ShortcutsHelp() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        pendingG.current = false;
        return;
      }
      if (pendingG.current) {
        const path = GOTO_PATHS[e.key.toLowerCase()];
        pendingG.current = false;
        if (path) {
          e.preventDefault();
          navigate(path);
        }
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        pendingG.current = true;
        window.setTimeout(() => {
          pendingG.current = false;
        }, 800);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (!open) return null;

  const rows = [
    ["⌘ / Ctrl + K", t("shortcutSearch")],
    ["⌘ / Ctrl + J", t("shortcutAssistant")],
    ["g then h/t/i/p/c/r/a", t("shortcutGoto")],
    ["?", t("shortcutHelp")],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">{t("shortcuts")}</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {rows.map(([keys, label]) => (
            <li key={keys} className="flex items-center justify-between gap-3">
              <span className="text-muted">{label}</span>
              <Kbd>{keys}</Kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
