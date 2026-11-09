import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

/** Lightweight dropdown menu with outside-click and Escape handling. */
export function Menu({ trigger, children, align = "right", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={cn("card absolute z-40 mt-2 min-w-44 overflow-hidden p-1 animate-slide-up", align === "right" ? "right-0" : "left-0", className)}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, danger, icon, disabled }: { children: ReactNode; onClick?: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean }) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface-2 disabled:opacity-50",
        danger ? "text-rose-500 hover:bg-rose-500/10" : "text-fg",
      )}
    >
      {icon && <span className="text-muted">{icon}</span>}
      {children}
    </button>
  );
}
