import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110 shadow-[0_8px_20px_-10px_var(--accent)]",
  secondary: "bg-surface-2 text-fg hover:bg-border/70",
  outline: "border border-border bg-transparent text-fg hover:bg-surface-2",
  ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-[background,transform,filter] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
