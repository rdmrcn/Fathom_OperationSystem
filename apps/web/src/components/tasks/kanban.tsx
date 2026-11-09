import type { Task, TaskStatus } from "@stratum/shared";
import { TASK_STATUS_LABELS } from "@stratum/shared";
import { groupByStatus } from "@/lib/board";
import {
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  DndContext,
  DragOverlay,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Avatar } from "@/components/ui/primitives";
import { COLUMN_ORDER, STATUS_COLOR } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { DueBadge, PriorityBadge, TypeBadge } from "./badges";

export function KanbanBoard({
  tasks,
  onOpen,
  onMove,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onMove: (taskId: number, status: TaskStatus, orderedIds: number[]) => void;
}) {
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const columns = groupByStatus(tasks);

  function onDragStart(e: DragStartEvent) {
    const id = Number(e.active.id);
    setActive(tasks.find((t) => t.id === id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const taskId = Number(a.id);
    const overId = String(over.id);
    const overIsColumn = COLUMN_ORDER.includes(overId as TaskStatus);
    const destStatus = (overIsColumn ? overId : (tasks.find((t) => t.id === Number(overId))?.status ?? a.data.current?.status)) as TaskStatus;
    if (!destStatus) return;
    const without = columns[destStatus].filter((t) => t.id !== taskId);
    let insertAt = without.length;
    if (!overIsColumn) {
      const idx = without.findIndex((t) => t.id === Number(overId));
      if (idx >= 0) insertAt = idx;
    }
    const ordered = [...without.slice(0, insertAt), tasks.find((t) => t.id === taskId)!, ...without.slice(insertAt)].map((t) => t.id);
    onMove(taskId, destStatus, ordered);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex min-h-[60vh] gap-3 overflow-x-auto pb-20 lg:overflow-x-visible lg:pb-4">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn key={status} status={status} tasks={columns[status]} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCard task={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ status, tasks, onOpen }: { status: TaskStatus; tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      data-testid={`kanban-column-${status}`}
      aria-label={TASK_STATUS_LABELS[status]}
      className={cn("flex w-64 min-w-56 shrink-0 flex-col rounded-2xl border border-border bg-surface-2/50 lg:w-auto lg:min-w-0 lg:flex-1", isOver && "ring-2 ring-accent/40")}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
          <h2 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h2>
        </div>
        <span className="text-xs tabular-nums text-subtle">{tasks.length}</span>
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} onOpen={onOpen} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { status: task.status } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-40")}>
      <TaskCard task={task} onOpen={onOpen} handleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export function TaskCard({
  task,
  onOpen,
  overlay,
  handleProps,
}: {
  task: Task;
  onOpen?: (t: Task) => void;
  overlay?: boolean;
  handleProps?: Record<string, unknown>;
}) {
  return (
    <article
      className={cn("card cursor-pointer p-3 text-left hover:border-accent/40", overlay && "rotate-1 shadow-xl")}
      onClick={() => onOpen?.(task)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-muted" {...handleProps}>
          {task.key}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{task.title}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TypeBadge type={task.type} />
        <DueBadge dueDate={task.dueDate} done={task.status === "done"} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Avatar user={task.assignee} size="xs" />
        {task.labels[0] && <span className="truncate text-[11px] text-subtle">{task.labels[0]}</span>}
      </div>
    </article>
  );
}
