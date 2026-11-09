import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Card, PageHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { useUpdateProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { useAuthStore } from "@/store/auth";

const COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#22c55e"];

export function SettingsPage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const update = useUpdateProfile();
  const [name, setName] = useState(user?.name ?? "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? COLORS[0]);

  if (!user) return null;

  return (
    <>
      <PageHeader title="Settings" description="Your profile is stored in dbo.Users. Role changes happen on the Team page." />
      <Card className="max-w-lg p-6">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void update
              .mutateAsync({ name, jobTitle: jobTitle || null, avatarColor })
              .then(() => toast.success("Profile saved"))
              .catch((err) => toast.error("Could not save", err instanceof ApiRequestError ? err.message : undefined));
          }}
        >
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email" value={user.email} disabled hint="Email cannot be changed in this demo" />
          <Input label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          <div>
            <p className="label">Avatar colour</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-surface", avatarColor === c ? "ring-accent" : "ring-transparent")}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <Button type="submit" loading={update.isPending}>
            Save profile
          </Button>
        </form>
      </Card>
      <Card className="mt-6 max-w-lg p-6">
        <h2 className="text-sm font-semibold">{t("aboutTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("aboutIntro")}</p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>
            <span className="font-medium text-fg">SQL Server</span> — keys, check constraints, a filtered overdue index, and a <code className="font-mono text-xs">reporting</code> schema the assistant can SELECT from.
          </li>
          <li>
            <span className="font-medium text-fg">Queries</span> — a tagged <code className="font-mono text-xs">sql</code> template; user input never concatenated into T-SQL.
          </li>
          <li>
            <span className="font-medium text-fg">Auth</span> — JWT access tokens plus rotating refresh tokens (reuse of a spent token revokes the family).
          </li>
          <li>
            <span className="font-medium text-fg">Assistant</span> — tool-calling against live data. Without <code className="font-mono text-xs">AI_API_KEY</code> a built-in engine uses the same tools.
          </li>
          <li>
            <span className="font-medium text-fg">Today / Inbox</span> — a standup briefing from your tasks, plus unread activity. EN/TR, CSV/JSON export, <code className="font-mono text-xs">g</code> then a letter to jump.
          </li>
        </ul>
      </Card>
    </>
  );
}
