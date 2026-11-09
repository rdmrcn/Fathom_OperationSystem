import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/** Modal built on the native <dialog> element (focus trap, Esc and backdrop handled by the browser). */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-slide-up",
        sizes[size],
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          {(title || description) && (
            <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                {title && <h2 className="text-base font-semibold">{title}</h2>}
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </header>
          )}
          <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  title?: ReactNode;
}

/** Right-hand slide-over panel. */
export function Drawer({ open, onClose, children, width = "max-w-xl", title }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn("fixed inset-y-0 right-0 m-0 ml-auto h-full max-h-none w-full border-l border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/40 open:animate-slide-in-right", width)}
    >
      {open && (
        <div className="flex h-full flex-col">
          {title !== undefined && (
            <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
              <div className="min-w-0 flex-1">{title}</div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </header>
          )}
          <div className="scrollbar-thin flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}
