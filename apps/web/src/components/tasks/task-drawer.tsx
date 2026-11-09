import type { Task, User } from "@stratum/shared";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ActivityList } from "@/components/activity/feed";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Avatar, Badge } from "@/components/ui/primitives";
import { useActivity, useAddComment, useComments, useDeleteTask, useUpdateTask } from "@/lib/queries";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { DueBadge, PriorityBadge, StatusBadge, TypeBadge } from "./badges";
import { emptyTaskForm, formToCreate, TaskFields, taskToForm, type TaskFormValue } from "./task-form";
import { useAuthStore } from "@/store/auth";
import { hasRole } from "@stratum/shared";

export function TaskDrawer({
  task,
  users,
  open,
  onClose,
}: {
  task: Task | null;
  users: User[];
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const comment = useAddComment();
  const comments = useComments(open ? task?.id : undefined);
  const activity = useActivity({ taskId: open ? task?.id : undefined, pageSize: 20 });
  const [editingId, setEditingId] = useState<number | null>(task?.id ?? null);
  const [form, setForm] = useState<TaskFormValue>(task ? taskToForm(task) : emptyTaskForm());
  const [body, setBody] = useState("");
  const user = useAuthStore((s) => s.user);
  const canDelete = Boolean(user && task && (hasRole(user.role, "manager") || task.reporterId === user.id));

  if (task && task.id !== editingId) {
    setEditingId(task.id);
    setForm(taskToForm(task));
    setBody("");
  }

  async function save() {
    if (!task) return;
    const input = formToCreate(form, task.projectId);
    try {
      await update.mutateAsync({
        id: task.id,
        input: {
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          type: input.type,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate,
          estimateHours: input.estimateHours,
          labels: input.labels,
        },
      });
      toast.success("Task updated");
    } catch (err) {
      toast.error("Could not save", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  async function destroy() {
    if (!task || !confirm(`Delete ${task.key}? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync({ id: task.id, projectId: task.projectId });
      toast.success(`${task.key} deleted`);
      onClose();
    } catch (err) {
      toast.error("Could not delete", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  async function postComment() {
    if (!task || !body.trim()) return;
    try {
      await comment.mutateAsync({ taskId: task.id, projectId: task.projectId, body: body.trim() });
      setBody("");
    } catch (err) {
      toast.error("Could not comment", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        task ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-xs text-muted">{task.key}</span>
            <span className="truncate text-sm font-semibold">{task.title}</span>
          </div>
        ) : (
          "Task"
        )
      }
    >
      {task && (
        <div className="space-y-6 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={form.status} />
            <PriorityBadge priority={form.priority} />
            <TypeBadge type={form.type} />
            <DueBadge dueDate={form.dueDate || null} done={form.status === "done"} />
          </div>
          <TaskFields value={form} onChange={setForm} users={users} />
          <div className="flex flex-wrap gap-1">
            {form.labels
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((l) => (
                <Badge key={l}>{l}</Badge>
              ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-subtle">
              Created {formatDateTime(task.createdAt)} · Updated {timeAgo(task.updatedAt)}
            </p>
            <div className="flex gap-2">
              {canDelete && (
                <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => void destroy()} loading={remove.isPending}>
                  Delete
                </Button>
              )}
              <Button size="sm" onClick={() => void save()} loading={update.isPending}>
                Save
              </Button>
            </div>
          </div>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Comments</h3>
            <ul className="space-y-3">
              {(comments.data ?? []).map((c) => (
                <li key={c.id} className="flex gap-2">
                  <Avatar user={c.author} size="sm" />
                  <div className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold">{c.author?.name ?? "Unknown"}</span>
                      <span className="text-[11px] text-subtle">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void postComment();
              }}
            >
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment…" rows={2} wrapperClassName="flex-1" />
              <Button type="submit" size="sm" disabled={!body.trim()} loading={comment.isPending} className="self-end">
                Post
              </Button>
            </form>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">History</h3>
            <ActivityList items={activity.data?.items ?? []} />
          </section>
        </div>
      )}
    </Drawer>
  );
}
