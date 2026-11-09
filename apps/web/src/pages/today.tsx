import type { Task } from "@stratum/shared";
import { format } from "date-fns";
import { Copy, Download } from "lucide-react";
import { Link } from "react-router";
import { ActivityList } from "@/components/activity/feed";
import { DueBadge, PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { useT } from "@/i18n";
import { downloadText } from "@/lib/csv";
import { useActivity, useTasks } from "@/lib/queries";
import { standupMarkdown } from "@/lib/standup";
import { todayIso } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

export function TodayPage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const today = todayIso();
  const overdue = useTasks({ mine: true, overdue: true, sort: "due", pageSize: 50 });
  const dueToday = useTasks({ mine: true, open: true, dueFrom: today, dueTo: today, sort: "priority", pageSize: 50 });
  const inProgress = useTasks({ mine: true, status: "in_progress", sort: "priority", pageSize: 50 });
  const activity = useActivity({ pageSize: 8 });

  const overdueItems = overdue.data?.items ?? [];
  const dueItems = dueToday.data?.items ?? [];
  const progressItems = inProgress.data?.items ?? [];
  const loading = overdue.isLoading || dueToday.isLoading || inProgress.isLoading;

  function markdown() {
    return standupMarkdown({
      date: today,
      name: user?.name ?? "teammate",
      overdue: overdueItems,
      dueToday: dueItems,
      inProgress: progressItems,
    });
  }

  async function copyStandup() {
    try {
      await navigator.clipboard.writeText(markdown());
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  if (loading) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        eyebrow={format(new Date(), "EEEE d MMMM yyyy")}
        title={t("todayTitle")}
        description={t("todayDesc")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={<Copy className="h-4 w-4" />} onClick={() => void copyStandup()}>
              {t("copyStandup")}
            </Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={() => downloadText(`fathom-standup-${today}.md`, markdown(), "text/markdown;charset=utf-8")}>
              {t("exportStandup")}
            </Button>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{t("overdue")}</p>
          <p className="mt-1 text-2xl font-semibold text-rose-500">{overdueItems.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{t("dueToday")}</p>
          <p className="mt-1 text-2xl font-semibold">{dueItems.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{t("inProgress")}</p>
          <p className="mt-1 text-2xl font-semibold">{progressItems.length}</p>
        </Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <TaskColumn title={t("overdue")} items={overdueItems} empty={t("nothingOverdue")} />
        <TaskColumn title={t("dueToday")} items={dueItems} empty={t("nothingDueToday")} />
        <TaskColumn title={t("inProgress")} items={progressItems} empty={t("nothingInProgress")} />
      </div>
      <Card className="mt-6 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("navActivity")}</h2>
          <Link to="/inbox" className="text-xs text-accent hover:underline">
            {t("navInbox")}
          </Link>
        </div>
        <ActivityList items={activity.data?.items ?? []} />
      </Card>
    </>
  );
}

function TaskColumn({ title, items, empty }: { title: string; items: Task[]; empty: string }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <EmptyState className="mt-3 py-8" title={empty} />
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.map((task) => (
            <li key={task.id} className="py-2.5">
              <Link to={`/projects/${task.projectId}?task=${task.id}`} className="block hover:text-accent">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted">{task.key}</span>
                  <span className="truncate text-sm font-medium">{task.title}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <DueBadge dueDate={task.dueDate} done={task.status === "done"} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
