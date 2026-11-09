import { addDays, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { useT } from "@/i18n";
import { useTasks } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function CalendarPage() {
  const t = useT();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const tasks = useTasks({ open: true, sort: "due", pageSize: 200 });
  const items = tasks.data?.items;

  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, NonNullable<typeof items>>();
    for (const task of items ?? []) {
      if (!task.dueDate) continue;
      const key = task.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const undated = (items ?? []).filter((task) => !task.dueDate);

  if (tasks.isLoading) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={t("calendarTitle")}
        description={t("calendarDesc")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCursor(addDays(cursor, -32))}>
              ←
            </Button>
            <Button variant="outline" onClick={() => setCursor(startOfMonth(new Date()))}>
              {format(cursor, "MMMM yyyy")}
            </Button>
            <Button variant="outline" onClick={() => setCursor(addDays(cursor, 32))}>
              →
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-surface-2/60 text-center text-[11px] font-semibold uppercase tracking-wide text-subtle">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-1 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = byDay.get(key) ?? [];
              const inMonth = day.getMonth() === cursor.getMonth();
              return (
                <div
                  key={key}
                  className={cn("min-h-24 border-b border-r border-border p-1.5", !inMonth && "bg-surface-2/30 text-subtle", isSameDay(day, new Date()) && "bg-accent-soft/40")}
                >
                  <p className="text-[11px] tabular-nums">{format(day, "d")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <li key={task.id}>
                        <Link to={`/projects/${task.projectId}?task=${task.id}`} className="block truncate rounded px-1 text-[11px] hover:bg-surface-2">
                          <span className="font-mono text-muted">{task.key}</span> {task.title}
                        </Link>
                      </li>
                    ))}
                    {dayTasks.length > 3 && <li className="px-1 text-[10px] text-subtle">+{dayTasks.length - 3}</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="card p-4">
          <h2 className="text-sm font-semibold">{t("noDue")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {undated.slice(0, 20).map((task) => (
              <li key={task.id}>
                <Link to={`/projects/${task.projectId}?task=${task.id}`} className="hover:text-accent">
                  <span className="font-mono text-[11px] text-muted">{task.key}</span> {task.title}
                </Link>
              </li>
            ))}
            {undated.length === 0 && <li className="text-xs text-muted">—</li>}
          </ul>
        </aside>
      </div>
    </>
  );
}
