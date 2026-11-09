import type { CreateTaskInput, Task, TaskPriority, TaskStatus, TaskType, User } from "@stratum/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from "@/lib/labels";

export interface TaskFormValue {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assigneeId: string;
  dueDate: string;
  estimateHours: string;
  labels: string;
}

export function emptyTaskForm(defaults: Partial<TaskFormValue> = {}): TaskFormValue {
  return {
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    type: "feature",
    assigneeId: "",
    dueDate: "",
    estimateHours: "",
    labels: "",
    ...defaults,
  };
}

export function taskToForm(task: Task): TaskFormValue {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    type: task.type,
    assigneeId: task.assigneeId ? String(task.assigneeId) : "",
    dueDate: task.dueDate ?? "",
    estimateHours: task.estimateHours != null ? String(task.estimateHours) : "",
    labels: task.labels.join(", "),
  };
}

export function formToCreate(form: TaskFormValue, projectId: number): CreateTaskInput {
  return {
    projectId,
    title: form.title.trim(),
    description: form.description.trim() || null,
    status: form.status,
    priority: form.priority,
    type: form.type,
    assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
    dueDate: form.dueDate || null,
    estimateHours: form.estimateHours ? Number(form.estimateHours) : null,
    labels: form.labels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function TaskFields({
  value,
  onChange,
  users,
  showStatus = true,
}: {
  value: TaskFormValue;
  onChange: (next: TaskFormValue) => void;
  users: User[];
  showStatus?: boolean;
}) {
  const set = (patch: Partial<TaskFormValue>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Title" value={value.title} onChange={(e) => set({ title: e.target.value })} wrapperClassName="sm:col-span-2" required />
      <Textarea label="Description" value={value.description} onChange={(e) => set({ description: e.target.value })} wrapperClassName="sm:col-span-2" rows={4} />
      {showStatus && <Select label="Status" value={value.status} onChange={(e) => set({ status: e.target.value as TaskStatus })} options={STATUS_OPTIONS} />}
      <Select label="Priority" value={value.priority} onChange={(e) => set({ priority: e.target.value as TaskPriority })} options={PRIORITY_OPTIONS} />
      <Select label="Type" value={value.type} onChange={(e) => set({ type: e.target.value as TaskType })} options={TYPE_OPTIONS} />
      <Select
        label="Assignee"
        value={value.assigneeId}
        onChange={(e) => set({ assigneeId: e.target.value })}
        options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]}
      />
      <Input label="Due date" type="date" value={value.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
      <Input label="Estimate (hours)" type="number" min={0} step={0.5} value={value.estimateHours} onChange={(e) => set({ estimateHours: e.target.value })} />
      <Input label="Labels" value={value.labels} onChange={(e) => set({ labels: e.target.value })} hint="Comma-separated" wrapperClassName="sm:col-span-2" />
    </div>
  );
}

export function TaskCreateForm({
  projectId,
  users,
  onSubmit,
  submitting,
}: {
  projectId: number;
  users: User[];
  onSubmit: (input: CreateTaskInput) => Promise<unknown>;
  submitting?: boolean;
}) {
  const [form, setForm] = useState(emptyTaskForm());
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(formToCreate(form, projectId));
      }}
    >
      <TaskFields value={form} onChange={setForm} users={users} />
      <div className="flex justify-end">
        <Button type="submit" loading={submitting} disabled={form.title.trim().length < 2}>
          Create task
        </Button>
      </div>
    </form>
  );
}
