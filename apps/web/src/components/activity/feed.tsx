import type { Activity } from "@stratum/shared";
import { Link } from "react-router";
import { Avatar } from "@/components/ui/primitives";
import { ACTIVITY_COPY } from "@/lib/labels";
import { timeAgo } from "@/lib/utils";

export function ActivityItem({ item }: { item: Activity }) {
  const verb = ACTIVITY_COPY[item.action] ?? item.action;
  const from = (item.details.from as string | undefined) ?? (item.details.changes as { status?: { from?: string } } | undefined)?.status?.from;
  const to = (item.details.to as string | undefined) ?? (item.details.changes as { status?: { to?: string } } | undefined)?.status?.to;
  const extra = from && to ? ` (${from.replace("_", " ")} → ${to.replace("_", " ")})` : "";
  const key = item.taskKey ?? (typeof item.details.key === "string" ? item.details.key : null);
  const title = item.taskTitle ?? (typeof item.details.title === "string" ? item.details.title : null);

  return (
    <li className="flex gap-3 py-3">
      <Avatar user={item.actor} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{item.actor?.name ?? "System"}</span> <span className="text-muted">{verb}</span>
          {key && item.projectId && (
            <>
              {" "}
              {item.taskId ? (
                <Link to={`/projects/${item.projectId}?task=${item.taskId}`} className="font-mono text-xs font-semibold text-accent hover:underline">
                  {key}
                </Link>
              ) : (
                <span className="font-mono text-xs font-semibold">{key}</span>
              )}
            </>
          )}
          {title && <span className="text-muted"> — {title}</span>}
          {!key && item.projectKey && item.projectId && (
            <>
              {" "}
              <Link to={`/projects/${item.projectId}`} className="font-mono text-xs font-semibold text-accent hover:underline">
                {item.projectKey}
              </Link>
            </>
          )}
          {extra && <span className="text-muted">{extra}</span>}
        </p>
        <p className="mt-0.5 text-xs text-subtle">{timeAgo(item.createdAt)}</p>
      </div>
    </li>
  );
}

export function ActivityList({ items }: { items: Activity[] }) {
  if (items.length === 0) return <p className="py-6 text-sm text-muted">No activity yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <ActivityItem key={item.id} item={item} />
      ))}
    </ul>
  );
}
