import { hasRole, type CreateProjectInput, type Project, type ProjectStatus } from "@stratum/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Badge, EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/ui/primitives";
import { HEALTH_LABEL, HEALTH_TONE, projectHealth } from "@/lib/health";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { PROJECT_STATUS_OPTIONS } from "@/lib/labels";
import { useCreateProject, useProjects, useUsers } from "@/lib/queries";
import { percent, pluralize } from "@/lib/utils";
import { ProjectStatusBadge } from "@/components/tasks/badges";
import { useAuthStore } from "@/store/auth";

export function ProjectsPage() {
  const projects = useProjects();
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const canCreate = user && hasRole(user.role, "manager");

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project has a key, a board and a per-project task number sequence in SQL Server."
        actions={
          canCreate ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              New project
            </Button>
          ) : undefined
        }
      />
      {projects.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : projects.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <EmptyState title="No projects yet" description="Create a project to start a board." />
      )}
      <ProjectDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const pct = percent(project.doneCount, project.taskCount);
  const health = projectHealth({ total: project.taskCount, done: project.doneCount, overdue: project.overdueCount });
  return (
    <Link to={`/projects/${project.id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} />
            <span className="font-mono text-xs text-muted">{project.key}</span>
          </div>
          <h2 className="mt-1 text-base font-semibold">{project.name}</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ProjectStatusBadge status={project.status} />
          <Badge tone={HEALTH_TONE[health.label]}>
            {HEALTH_LABEL[health.label]} {health.score}
          </Badge>
        </div>
      </div>
      {project.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{project.description}</p>}
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>
          {project.doneCount}/{project.taskCount} done · {pct}%
        </span>
        {project.overdueCount > 0 && <span className="text-rose-500">{project.overdueCount} overdue</span>}
      </div>
      <ProgressBar className="mt-2" value={pct} color={project.color} />
      <p className="mt-3 text-xs text-subtle">Lead {project.lead?.name ?? "—"} · {pluralize(project.memberCount, "member")}</p>
    </Link>
  );
}

function ProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateProject();
  const users = useUsers();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [color, setColor] = useState("#6366f1");
  const [leadId, setLeadId] = useState("");

  async function submit() {
    const input: CreateProjectInput = {
      key: key.toUpperCase(),
      name,
      description: description || null,
      status,
      color,
      leadId: leadId ? Number(leadId) : null,
    };
    try {
      await create.mutateAsync(input);
      toast.success("Project created");
      onClose();
      setKey("");
      setName("");
      setDescription("");
    } catch (err) {
      toast.error("Could not create project", err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={create.isPending} disabled={name.trim().length < 2 || key.trim().length < 2}>
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Key" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="PAY" maxLength={6} hint="2–6 letters/digits" />
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Payments Platform" />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} wrapperClassName="sm:col-span-2" rows={3} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} options={PROJECT_STATUS_OPTIONS} />
        <Select
          label="Lead"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          options={[{ value: "", label: "None" }, ...(users.data ?? []).map((u) => ({ value: String(u.id), label: u.name }))]}
        />
        <Input label="Colour" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
    </Dialog>
  );
}
