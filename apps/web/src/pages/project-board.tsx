import { hasRole, type Task, type TaskStatus } from "@stratum/shared";
import { Plus, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { BreakdownDialog } from "@/components/assistant/breakdown-dialog";
import { KanbanBoard } from "@/components/tasks/kanban";
import { TaskCreateForm } from "@/components/tasks/task-form";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Card, PageHeader, ProgressBar, Skeleton } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { useAssistantCapabilities, useBoard, useCreateTask, useMoveTask, useProject, useProjectMembers, useProjectSummary, useUsers } from "@/lib/queries";
import { cn, percent } from "@/lib/utils";
import { Markdown } from "@/components/assistant/markdown";
import { ProjectStatusBadge } from "@/components/tasks/badges";
import { useAuthStore } from "@/store/auth";

export function ProjectBoardPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const [params, setParams] = useSearchParams();
  const project = useProject(projectId);
  const board = useBoard(projectId);
  const users = useUsers();
  const members = useProjectMembers(projectId);
  const move = useMoveTask(projectId);
  const create = useCreateTask();
  const [createOpen, setCreateOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [summaryOn, setSummaryOn] = useState(false);
  const summary = useProjectSummary(projectId, summaryOn);
  const caps = useAssistantCapabilities();
  const user = useAuthStore((s) => s.user);

  const selectedId = Number(params.get("task") || 0) || null;
  const selected = useMemo(() => board.data?.find((t) => t.id === selectedId) ?? null, [board.data, selectedId]);

  function openTask(task: Task) {
    setParams({ task: String(task.id) }, { replace: true });
  }
  function closeTask() {
    params.delete("task");
    setParams(params, { replace: true });
  }

  if (project.isLoading) return <Skeleton className="h-96" />;
  if (!project.data) return <p className="text-sm text-rose-500">Project not found.</p>;
  const p = project.data;
  const pct = percent(p.doneCount, p.taskCount);

  return (
    <>
      <PageHeader
        eyebrow={p.key}
        title={p.name}
        description={p.description ?? undefined}
        actions={
          <>
            <Button variant="outline" icon={<Sparkles className="h-4 w-4" />} onClick={() => setSummaryOn(true)} loading={summary.isFetching && summaryOn}>
              AI summary
            </Button>
            <Button variant="outline" icon={<Wand2 className="h-4 w-4" />} onClick={() => setBreakdownOpen(true)}>
              Break down a goal
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              New task
            </Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <ProjectStatusBadge status={p.status} />
        <div className="flex min-w-48 max-w-xs flex-1 items-center gap-3">
          <ProgressBar value={pct} color={p.color} />
          <span className="text-xs text-muted">{pct}%</span>
        </div>
        <span className="text-xs text-muted">
          {p.doneCount}/{p.taskCount} done
          {p.overdueCount > 0 && <span className="text-rose-500"> · {p.overdueCount} overdue</span>}
          {p.lead && ` · Lead ${p.lead.name}`}
          {p.targetDate && ` · Target ${p.targetDate}`}
        </span>
        {user && hasRole(user.role, "manager") && (
          <span className="text-xs text-subtle">{members.data?.length ?? p.memberCount} members</span>
        )}
      </div>
      {summaryOn && summary.data && (
        <Card className={cn("mb-5 p-5", summary.data.health === "off_track" && "border-rose-500/40", summary.data.health === "at_risk" && "border-amber-500/40")}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Assistant summary · {summary.data.source === "llm" ? caps.data?.model ?? "LLM" : "built-in engine"} · {summary.data.health.replace("_", " ")}
            </p>
            <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setSummaryOn(false)}>
              Hide
            </button>
          </div>
          <Markdown text={summary.data.summary} />
        </Card>
      )}
      {board.isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <KanbanBoard
          tasks={board.data ?? []}
          onOpen={openTask}
          onMove={(taskId, status, orderedIds) => {
            void move.mutateAsync({ id: taskId, input: { status: status as TaskStatus, orderedIds } }).catch((err) => {
              toast.error("Could not move task", err instanceof ApiRequestError ? err.message : undefined);
            });
          }}
        />
      )}
      <TaskDrawer task={selected} users={users.data ?? []} open={Boolean(selected)} onClose={closeTask} />
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New task" size="lg">
        <TaskCreateForm
          projectId={projectId}
          users={users.data ?? []}
          submitting={create.isPending}
          onSubmit={async (input) => {
            try {
              const task = await create.mutateAsync(input);
              toast.success(`${task.key} created`);
              setCreateOpen(false);
              openTask(task);
            } catch (err) {
              toast.error("Could not create task", err instanceof ApiRequestError ? err.message : undefined);
            }
          }}
        />
      </Dialog>
      <BreakdownDialog projectId={projectId} open={breakdownOpen} onClose={() => setBreakdownOpen(false)} />
    </>
  );
}
