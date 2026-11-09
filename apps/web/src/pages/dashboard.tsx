import type { DashboardStats } from "@stratum/shared";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@stratum/shared";
import { AlertTriangle, CheckCircle2, FolderKanban, ListTodo } from "lucide-react";
import { Link } from "react-router";
import { ActivityList } from "@/components/activity/feed";
import { DueBadge, PriorityBadge } from "@/components/tasks/badges";
import { Avatar, Badge, Card, PageHeader, ProgressBar, Skeleton } from "@/components/ui/primitives";
import { HEALTH_LABEL, HEALTH_TONE, projectHealth } from "@/lib/health";
import { PRIORITY_COLOR, STATUS_COLOR } from "@/lib/labels";
import { useT } from "@/i18n";
import { useDashboard } from "@/lib/queries";
import { cn, percent, pluralize } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof ListTodo; label: string; value: number | string; hint?: string; tone?: "danger" | "ok" }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tracking-tight", tone === "danger" && value !== 0 && "text-rose-500")}>{value}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        <span className="rounded-xl bg-surface-2 p-2 text-muted">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Card>
  );
}

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--fg)" };

export function DashboardPage() {
  const t = useT();
  const q = useDashboard();
  if (q.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (q.isError || !q.data) return <p className="text-sm text-rose-500">Could not load the dashboard.</p>;
  const d = q.data;
  return (
    <>
      <PageHeader title={t("dashTitle")} description={t("dashDesc")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={FolderKanban} label="Active projects" value={d.totals.activeProjects} hint={`${d.totals.projects} total`} />
        <Stat icon={ListTodo} label="Open tasks" value={d.totals.openTasks} hint={`${d.totals.tasks} in the database`} />
        <Stat icon={AlertTriangle} label="Overdue" value={d.totals.overdue} tone="danger" hint="Open tasks past due" />
        <Stat icon={CheckCircle2} label="Done this week" value={d.totals.completedLast7Days} hint={`${d.totals.createdLast7Days} created`} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold">Throughput · 8 weeks</h2>
          <p className="mb-4 text-xs text-muted">Tasks created vs completed per ISO week (from SQL Server).</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.throughput} barGap={2}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="weekStart" tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} width={28} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="created" name="Created" fill="#818cf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Work by status</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byStatus.map((s) => ({ ...s, label: TASK_STATUS_LABELS[s.status] }))} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={90} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {d.byStatus.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLOR[s.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Project progress</h2>
          <ul className="mt-4 space-y-3">
            {d.projectProgress.map((p) => {
              const health = projectHealth(p);
              return (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="flex items-center justify-between text-sm hover:text-accent">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="font-mono text-xs text-muted">{p.key}</span>
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      <Badge tone={HEALTH_TONE[health.label]}>{HEALTH_LABEL[health.label]} {health.score}</Badge>
                      {p.done}/{p.total} · {percent(p.done, p.total)}%
                    </span>
                  </Link>
                  <ProgressBar className="mt-1.5" value={percent(p.done, p.total)} color={p.color} />
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Workload</h2>
          <ul className="mt-4 space-y-3">
            {d.workload.map((w) => (
              <li key={w.user.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar user={w.user} size="xs" />
                  <span className="truncate font-medium">{w.user.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {pluralize(w.open, "open")}
                  {w.overdue > 0 && <span className="text-rose-500"> · {w.overdue} overdue</span>}
                  {w.estimateHours > 0 && ` · ~${Math.round(w.estimateHours)}h`}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Open by priority</h3>
            <div className="mt-2 flex gap-1 overflow-hidden rounded-full">
              {d.byPriority.map((p) => (
                <div
                  key={p.priority}
                  title={`${TASK_PRIORITY_LABELS[p.priority]}: ${p.count}`}
                  className="h-2 min-w-1"
                  style={{ flexGrow: p.count || 0.15, background: PRIORITY_COLOR[p.priority] }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
              {d.byPriority.map((p) => (
                <span key={p.priority}>
                  {TASK_PRIORITY_LABELS[p.priority]} {p.count}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Overdue</h2>
            <Link to="/tasks?overdue=true" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </div>
          <OverdueList stats={d} />
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Link to="/activity" className="text-xs text-accent hover:underline">
              Full feed
            </Link>
          </div>
          <ActivityList items={d.recentActivity} />
        </Card>
      </div>
    </>
  );
}

function OverdueList({ stats }: { stats: DashboardStats }) {
  if (stats.overdueTasks.length === 0) return <p className="py-6 text-sm text-muted">Nothing is overdue.</p>;
  return (
    <ul className="divide-y divide-border">
      {stats.overdueTasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2.5">
          <Link to={`/projects/${t.projectId}?task=${t.id}`} className="min-w-0 flex-1 hover:text-accent">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted">{t.key}</span>
              <span className="truncate text-sm font-medium">{t.title}</span>
            </div>
          </Link>
          <PriorityBadge priority={t.priority} />
          <DueBadge dueDate={t.dueDate} done={false} />
        </li>
      ))}
    </ul>
  );
}
