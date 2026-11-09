import type { HTMLAttributes, ReactNode } from "react";
import type { UserSummary } from "@stratum/shared";
import { cn, initials } from "@/lib/utils";

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold leading-5 whitespace-nowrap", tones[tone], className)} {...props} />;
}

export function Avatar({ user, size = "md", className }: { user: Pick<UserSummary, "name" | "avatarColor"> | null | undefined; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const sizes = { xs: "h-5 w-5 text-[9px]", sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-12 w-12 text-base" };
  if (!user) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[8px] text-subtle", sizes[size], className)}
        title="Unassigned"
        aria-label="Unassigned"
      />
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface", sizes[size], className)}
      style={{ background: `linear-gradient(135deg, ${user.avatarColor}, color-mix(in oklab, ${user.avatarColor} 60%, black))` }}
      title={user.name}
      aria-label={user.name}
    >
      {initials(user.name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent", className)} role="status" aria-label="Loading" />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">{eyebrow}</div>}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">{children}</kbd>;
}

export function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}
