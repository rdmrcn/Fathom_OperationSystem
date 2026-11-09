import type { BreakdownSuggestion } from "@stratum/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { PRIORITY_TONE, TYPE_TONE } from "@/lib/labels";
import { useApplyBreakdown, useBreakdown } from "@/lib/queries";

export function BreakdownDialog({ projectId, open, onClose }: { projectId: number; open: boolean; onClose: () => void }) {
  const breakdown = useBreakdown();
  const apply = useApplyBreakdown();
  const [goal, setGoal] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const suggestions = breakdown.data?.suggestions ?? [];

  function toggle(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function generate() {
    try {
      const data = await breakdown.mutateAsync({ projectId, goal, maxTasks: 6 });
      setPicked(new Set(data.suggestions.map((_, i) => i)));
    } catch (err) {
      toast.error("Could not generate tasks", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  async function createSelected() {
    const tasks = suggestions.filter((_, i) => picked.has(i));
    if (!tasks.length) return;
    try {
      const created = await apply.mutateAsync({ projectId, tasks });
      toast.success(`Created ${created.length} tasks in the backlog`);
      onClose();
      setGoal("");
      setPicked(new Set());
      breakdown.reset();
    } catch (err) {
      toast.error("Could not create tasks", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Break a goal into tasks"
      description="The assistant proposes a delivery plan. You pick which tasks to add — nothing is written until you confirm."
      size="lg"
      footer={
        suggestions.length ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void createSelected()} loading={apply.isPending} disabled={picked.size === 0}>
              Add {picked.size} to backlog
            </Button>
          </>
        ) : undefined
      }
    >
      <Textarea
        label="Goal"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="e.g. Automate weekly SQL Server backup restore drills into a scratch instance"
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={() => void generate()} loading={breakdown.isPending} disabled={goal.trim().length < 10}>
          Generate suggestions
        </Button>
      </div>
      {breakdown.data && (
        <p className="mt-4 text-xs text-subtle">
          Source: {breakdown.data.source === "llm" ? "language model" : "built-in planner"} · click a card to include/exclude
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {suggestions.map((s, i) => (
          <SuggestionCard key={i} suggestion={s} selected={picked.has(i)} onToggle={() => toggle(i)} />
        ))}
      </ul>
    </Dialog>
  );
}

function SuggestionCard({ suggestion, selected, onToggle }: { suggestion: BreakdownSuggestion; selected: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-accent bg-accent-soft/40" : "border-border hover:border-accent/40"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{suggestion.title}</span>
          <Badge tone={TYPE_TONE[suggestion.type]}>{suggestion.type}</Badge>
          <Badge tone={PRIORITY_TONE[suggestion.priority]}>{suggestion.priority}</Badge>
          <span className="text-[11px] text-subtle">~{suggestion.estimateHours}h</span>
        </div>
        {suggestion.description && <p className="mt-1 text-sm text-muted">{suggestion.description}</p>}
      </button>
    </li>
  );
}
