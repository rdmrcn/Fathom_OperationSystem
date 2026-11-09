export type HealthLabel = "healthy" | "watch" | "at_risk";

export interface ProjectHealthInput {
  total: number;
  done: number;
  overdue: number;
}

export function projectHealth(input: ProjectHealthInput): { score: number; label: HealthLabel } {
  if (input.total <= 0) return { score: 100, label: "healthy" };
  const completion = clamp(input.done / input.total);
  const overdueRatio = clamp(input.overdue / input.total);
  const score = Math.round(completion * 70 + (1 - overdueRatio) * 30);
  if (overdueRatio >= 0.25 || score < 40) return { score, label: "at_risk" };
  if (overdueRatio >= 0.1 || score < 70) return { score, label: "watch" };
  return { score, label: "healthy" };
}

export const HEALTH_TONE: Record<HealthLabel, "success" | "warning" | "danger"> = {
  healthy: "success",
  watch: "warning",
  at_risk: "danger",
};

export const HEALTH_LABEL: Record<HealthLabel, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
};

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
