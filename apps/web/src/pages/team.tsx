import { hasRole, type Role, type User } from "@stratum/shared";
import { Avatar, Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { ROLE_OPTIONS, ROLE_TONE } from "@/lib/labels";
import { useChangeRole, useDashboard, useSetUserActive, useUsers } from "@/lib/queries";
import { formatDate, pluralize } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

export function TeamPage() {
  const users = useUsers();
  const dash = useDashboard();
  const me = useAuthStore((s) => s.user);
  const isAdmin = Boolean(me && hasRole(me.role, "admin"));
  const changeRole = useChangeRole();
  const setActive = useSetUserActive();
  const load = new Map((dash.data?.workload ?? []).map((w) => [w.user.id, w]));

  return (
    <>
      <PageHeader title="Team" description="People in this workspace. Admins can change roles and deactivate accounts." />
      {users.isLoading ? (
        <Skeleton className="h-64" />
      ) : users.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {users.data.map((u) => (
            <MemberCard
              key={u.id}
              user={u}
              open={load.get(u.id)?.open ?? 0}
              overdue={load.get(u.id)?.overdue ?? 0}
              hours={load.get(u.id)?.estimateHours ?? 0}
              isAdmin={isAdmin}
              self={me?.id === u.id}
              onRole={async (role) => {
                try {
                  await changeRole.mutateAsync({ userId: u.id, role });
                  toast.success(`${u.name} is now ${role}`);
                } catch (err) {
                  toast.error("Could not change role", err instanceof ApiRequestError ? err.message : undefined);
                }
              }}
              onActive={async (isActive) => {
                try {
                  await setActive.mutateAsync({ userId: u.id, isActive });
                  toast.success(isActive ? `${u.name} reactivated` : `${u.name} deactivated`);
                } catch (err) {
                  toast.error("Could not update account", err instanceof ApiRequestError ? err.message : undefined);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No people yet" />
      )}
    </>
  );
}

function MemberCard({
  user,
  open,
  overdue,
  hours,
  isAdmin,
  self,
  onRole,
  onActive,
}: {
  user: User;
  open: number;
  overdue: number;
  hours: number;
  isAdmin: boolean;
  self: boolean;
  onRole: (role: Role) => Promise<void>;
  onActive: (active: boolean) => Promise<void>;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Avatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{user.name}</h2>
            <Badge tone={ROLE_TONE[user.role]}>{user.role}</Badge>
            {!user.isActive && <Badge tone="danger">inactive</Badge>}
          </div>
          <p className="truncate text-sm text-muted">{user.jobTitle ?? "—"}</p>
          <p className="truncate text-xs text-subtle">{user.email}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        {pluralize(open, "open task")}
        {overdue > 0 && <span className="text-rose-500"> · {overdue} overdue</span>}
        {hours > 0 && ` · ~${Math.round(hours)}h`}
      </p>
      <p className="mt-1 text-xs text-subtle">Joined {formatDate(user.createdAt)}</p>
      {isAdmin && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Select value={user.role} onChange={(e) => void onRole(e.target.value as Role)} options={ROLE_OPTIONS} disabled={self} />
          <button
            type="button"
            disabled={self}
            onClick={() => void onActive(!user.isActive)}
            className="rounded-xl border border-border px-3 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      )}
    </Card>
  );
}
