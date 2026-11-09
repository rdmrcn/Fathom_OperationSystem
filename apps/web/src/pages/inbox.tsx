import { useEffect, useState } from "react";
import { ActivityList } from "@/components/activity/feed";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useT } from "@/i18n";
import { useActivity } from "@/lib/queries";
import { useUiStore } from "@/store/ui";

export function InboxPage() {
  const t = useT();
  const feed = useActivity({ pageSize: 40 });
  const markInboxSeen = useUiStore((s) => s.markInboxSeen);
  const [seenSnapshot] = useState(() => useUiStore.getState().inboxSeenAt);
  const items = feed.data?.items ?? [];
  const unread = items.filter((item) => !seenSnapshot || item.createdAt > seenSnapshot);

  useEffect(() => {
    markInboxSeen();
  }, [markInboxSeen]);

  return (
    <>
      <PageHeader
        title={t("inboxTitle")}
        description={t("inboxDesc")}
        actions={
          <Button variant="outline" onClick={markInboxSeen}>
            {t("markRead")}
          </Button>
        }
      />
      {feed.isLoading ? (
        <Skeleton className="h-96" />
      ) : items.length === 0 ? (
        <EmptyState title={t("inboxEmpty")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card className="p-4">
            <ActivityList items={items} />
          </Card>
          <aside className="card h-fit p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{t("unread")}</p>
            <p className="mt-1 text-2xl font-semibold">{unread.length}</p>
            <p className="mt-2 text-sm text-muted">{t("inboxHint")}</p>
          </aside>
        </div>
      )}
    </>
  );
}
