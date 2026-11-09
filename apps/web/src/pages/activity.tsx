import { ActivityList } from "@/components/activity/feed";
import { Select } from "@/components/ui/field";
import { Card, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useActivity, useProjects } from "@/lib/queries";
import { useState } from "react";

export function ActivityPage() {
  const [projectId, setProjectId] = useState("");
  const projects = useProjects();
  const feed = useActivity({ projectId: projectId ? Number(projectId) : undefined, pageSize: 50 });
  return (
    <>
      <PageHeader title="Activity" description="Every create, move, comment and AI-generated task is written to ActivityLog in SQL Server." />
      <div className="mb-4 max-w-xs">
        <Select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={[{ value: "", label: "All projects" }, ...(projects.data ?? []).map((p) => ({ value: String(p.id), label: `${p.key} · ${p.name}` }))]}
        />
      </div>
      <Card className="px-5">
        {feed.isLoading ? <Skeleton className="my-6 h-48" /> : <ActivityList items={feed.data?.items ?? []} />}
      </Card>
    </>
  );
}
