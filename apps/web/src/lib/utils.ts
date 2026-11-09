import clsx, { type ClassValue } from "clsx";
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(value: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!value) return "—";
  return format(parseISO(value), pattern);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return format(parseISO(value), "d MMM yyyy, HH:mm");
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "";
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

/** Human-friendly due-date label plus a tone for colouring (overdue / soon / normal). */
export function dueLabel(dueDate: string | null, done: boolean): { text: string; tone: "overdue" | "soon" | "normal" | "none" } {
  if (!dueDate) return { text: "No due date", tone: "none" };
  const date = parseISO(dueDate);
  const days = differenceInCalendarDays(date, new Date());
  if (done) return { text: format(date, "d MMM"), tone: "none" };
  if (days < 0) return { text: `${-days}d overdue`, tone: "overdue" };
  if (isToday(date)) return { text: "Due today", tone: "soon" };
  if (isTomorrow(date)) return { text: "Due tomorrow", tone: "soon" };
  if (isYesterday(date)) return { text: "1d overdue", tone: "overdue" };
  if (days <= 7) return { text: `Due in ${days}d`, tone: "soon" };
  return { text: format(date, "d MMM"), tone: "normal" };
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
