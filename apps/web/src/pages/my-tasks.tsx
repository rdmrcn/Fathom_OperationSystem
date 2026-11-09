import type { Task, TaskPriority, TaskStatus, TaskType } from "@stratum/shared";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DueBadge, PriorityBadge, StatusBadge, TypeBadge } from "@/components/tasks/badges";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { Input, Select } from "@/components/ui/field";
import { Avatar, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from "@/lib/labels";
import { useTasks, useUsers } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function MyTasksPage() {
  const [params, setParams] = useSearchParams();
  const overdue = params.get("overdue") === "true";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [type, setType] = useState<string>("");
  const query = useTasks({
    mine: !overdue,
    overdue: overdue || undefined,
    q: q || undefined,
    status: status || undefined,
    priority: priority || undefined,
    type: type || undefined,
    sort: overdue ? "due" : "priority",
    pageSize: 100,
  });
  const users = useUsers();
  const [openId, setOpenId] = useState<number | null>(null);
  const selected = useMemo(() => query.data?.items.find((t) => t.id === openId) ?? null, [query.data, openId]);

  return (
    <>
      <PageHeader
        title={overdue ? "Overdue tasks" : "My tasks"}
        description={overdue ? "Open work past its due date across every project." : "Everything assigned to you, ordered by priority."}
        actions={
          <button
            type="button"
            className={cn("text-sm", overdue ? "text-accent" : "text-muted hover:text-fg")}
            onClick={() => setParams(overdue ? {} : { overdue: "true" })}
          >
            {overdue ? "Show mine" : "Show overdue (all)"}
          </button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Input placeholder="Search title or PAY-7" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "Any status" }, ...STATUS_OPTIONS]} />
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: "", label: "Any priority" }, ...PRIORITY_OPTIONS]} />
        <Select value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "", label: "Any type" }, ...TYPE_OPTIONS]} />
      </div>
      {query.isLoading ? (
        <Skeleton className="h-64" />
      ) : query.data?.items.length ? (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Task</th>
                <th className="px-3 py-2.5 font-semibold">Project</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Priority</th>
                <th className="px-3 py-2.5 font-semibold">Due</th>
                <th className="px-4 py-2.5 font-semibold">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.data.items.map((t) => (
                <TaskRow key={t.id} task={t} onOpen={() => setOpenId(t.id)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No matching tasks" description="Try clearing the filters." />
      )}
      <TaskDrawer task={selected} users={users.data ?? []} open={Boolean(selected)} onClose={() => setOpenId(null)} />
    </>
  );
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer hover:bg-surface-2/50" onClick={onOpen}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted">{task.key}</span>
          <span className="font-medium">{task.title}</span>
          <TypeBadge type={task.type as TaskType} />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <Link to={`/projects/${task.projectId}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
          {task.projectKey}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={task.status as TaskStatus} />
      </td>
      <td className="px-3 py-2.5">
        <PriorityBadge priority={task.priority as TaskPriority} />
      </td>
      <td className="px-3 py-2.5">
        <DueBadge dueDate={task.dueDate} done={task.status === "done"} />
      </td>
      <td className="px-4 py-2.5">
        <Avatar user={task.assignee} size="xs" />
      </td>
    </tr>
  );
}
