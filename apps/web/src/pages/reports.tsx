import { Download } from "lucide-react";
import { Link } from "react-router";
import { DueBadge, PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Skeleton } from "@/components/ui/primitives";
import { downloadText, tasksToCsv, tasksToJson } from "@/lib/csv";
import { useDashboard, useTasks } from "@/lib/queries";
import { useT } from "@/i18n";
import { todayIso } from "@/lib/utils";

export function ReportsPage() {
  const t = useT();
  const dash = useDashboard();
  const tasks = useTasks({ sort: "due", pageSize: 200 });

  function exportCsv() {
    const rows = tasks.data?.items ?? [];
    downloadText(`fathom-tasks-${todayIso()}.csv`, tasksToCsv(rows));
  }

  function exportJson() {
    const rows = tasks.data?.items ?? [];
    downloadText(`fathom-tasks-${todayIso()}.json`, tasksToJson(rows), "application/json;charset=utf-8");
  }

  if (dash.isLoading || tasks.isLoading) return <Skeleton className="h-96" />;
  const d = dash.data;
  const items = tasks.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t("reportsTitle")}
        description={t("reportsDesc")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportJson} disabled={items.length === 0}>
              {t("exportJson")}
            </Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={items.length === 0}>
              {t("exportCsv")}
            </Button>
          </div>
        }
      />
      {d && (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Open</p>
            <p className="mt-1 text-2xl font-semibold">{d.totals.openTasks}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Overdue</p>
            <p className="mt-1 text-2xl font-semibold text-rose-500">{d.totals.overdue}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Done (7d)</p>
            <p className="mt-1 text-2xl font-semibold">{d.totals.completedLast7Days}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Created (7d)</p>
            <p className="mt-1 text-2xl font-semibold">{d.totals.createdLast7Days}</p>
          </Card>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Task</th>
              <th className="px-3 py-2.5 font-semibold">Project</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Priority</th>
              <th className="px-4 py-2.5 font-semibold">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.slice(0, 80).map((task) => (
              <tr key={task.id} className="hover:bg-surface-2/50">
                <td className="px-4 py-2.5">
                  <Link to={`/projects/${task.projectId}?task=${task.id}`} className="hover:text-accent">
                    <span className="font-mono text-[11px] text-muted">{task.key}</span>{" "}
                    <span className="font-medium">{task.title}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{task.projectKey}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-3 py-2.5">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="px-4 py-2.5">
                  <DueBadge dueDate={task.dueDate} done={task.status === "done"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
