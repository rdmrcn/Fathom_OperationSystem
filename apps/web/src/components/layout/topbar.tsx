import { hasRole } from "@stratum/shared";
import { Bell, LogOut, Moon, Search, Settings, Sparkles, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Avatar } from "@/components/ui/primitives";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { matchCommands } from "@/lib/commands";
import { useActivity, useProjects, useTasks } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useUiStore } from "@/store/ui";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const theme = useUiStore((s) => s.theme);
  const locale = useUiStore((s) => s.locale);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setLocale = useUiStore((s) => s.setLocale);
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);
  const tx = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const projects = useProjects();
  const inboxSeenAt = useUiStore((s) => s.inboxSeenAt);
  const activity = useActivity({ pageSize: 20 });
  const unread = (activity.data?.items ?? []).filter((item) => !inboxSeenAt || item.createdAt > inboxSeenAt).length;
  const needle = q.trim();
  const taskHits = useTasks({ q: needle, pageSize: 6, sort: "updated" }, { enabled: open && needle.length >= 2 });
  const commandMatches = useMemo(() => matchCommands(needle).slice(0, 8), [needle]);

  const projectMatches = useMemo(() => {
    const n = needle.toLowerCase();
    if (n.length < 1) return [];
    return (projects.data ?? [])
      .filter((p) => p.name.toLowerCase().includes(n) || p.key.toLowerCase().includes(n))
      .slice(0, 6);
  }, [needle, projects.data]);

  const taskMatches = taskHits.data?.items ?? [];
  const hasResults = commandMatches.length > 0 || projectMatches.length > 0 || taskMatches.length > 0;

  function goToFirstHit() {
    const exact = taskMatches.find((t) => t.key.toLowerCase() === needle.toLowerCase());
    const task = exact ?? taskMatches[0];
    if (task) {
      navigate(`/projects/${task.projectId}?task=${task.id}`);
      setOpen(false);
      setQ("");
      return;
    }
    if (projectMatches[0]) {
      navigate(`/projects/${projectMatches[0].id}`);
      setOpen(false);
      setQ("");
      return;
    }
    if (commandMatches[0]) {
      navigate(commandMatches[0].to);
      setOpen(false);
      setQ("");
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistantOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAssistantOpen]);

  async function signOut() {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      await api("/api/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
    } catch {
      // Local session is cleared either way.
    }
    clear();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          id="global-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={tx("search")}
          className="input h-9 pl-9 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              goToFirstHit();
            }
          }}
        />
        {open && (hasResults || (needle.length >= 2 && taskHits.isFetching)) && (
          <div className="card absolute z-40 mt-1.5 w-full overflow-hidden p-1">
            {commandMatches.length > 0 && (
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">{tx("commands")}</p>
            )}
            {commandMatches.map((cmd) => (
              <Link
                key={cmd.id}
                to={cmd.to}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
              >
                <span>{cmd.label}</span>
                <span className="font-mono text-[10px] text-subtle">{cmd.hint}</span>
              </Link>
            ))}
            {projectMatches.length > 0 && (
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">{tx("navProjects")}</p>
            )}
            {projectMatches.map((p) => (
              <Link
                key={`p-${p.id}`}
                to={`/projects/${p.id}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-2"
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <span className="font-mono text-xs text-muted">{p.key}</span>
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
            {taskMatches.length > 0 && (
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">{tx("navTasks")}</p>
            )}
            {taskMatches.map((task) => (
              <Link
                key={`t-${task.id}`}
                to={`/projects/${task.projectId}?task=${task.id}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-2"
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="font-mono text-xs text-accent">{task.key}</span>
                <span className="truncate">{task.title}</span>
              </Link>
            ))}
            {needle.length >= 2 && !taskHits.isFetching && !hasResults && (
              <p className="px-2.5 py-2 text-xs text-muted">{tx("noMatches")}</p>
            )}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <Link
          to="/inbox"
          className="relative rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={tx("navInbox")}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className={cn("hidden items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft sm:inline-flex")}
        >
          <Sparkles className="h-4 w-4" />
          {tx("askAi")}
        </button>
        <div className="flex rounded-xl border border-border p-0.5 text-[11px] font-semibold">
          <button type="button" className={cn("rounded-lg px-1.5 py-1", locale === "en" ? "bg-surface-2 text-fg" : "text-muted")} onClick={() => setLocale("en")}>
            {tx("langEn")}
          </button>
          <button type="button" className={cn("rounded-lg px-1.5 py-1", locale === "tr" ? "bg-surface-2 text-fg" : "text-muted")} onClick={() => setLocale("tr")}>
            {tx("langTr")}
          </button>
        </div>
        <button type="button" onClick={toggleTheme} className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label={tx("theme")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {user && (
          <Menu
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2">
                <Avatar user={user} size="sm" />
                <span className="hidden max-w-[140px] truncate text-sm font-medium sm:block">{user.name}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="border-b border-border px-2.5 py-2">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted">{user.email}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-subtle">
                    {user.role}
                    {hasRole(user.role, "manager") ? " · can manage projects" : ""}
                  </div>
                </div>
                <MenuItem
                  icon={<Settings className="h-4 w-4" />}
                  onClick={() => {
                    close();
                    navigate("/settings");
                  }}
                >
                  {tx("settings")}
                </MenuItem>
                <MenuItem
                  icon={<LogOut className="h-4 w-4" />}
                  onClick={() => {
                    close();
                    void signOut();
                  }}
                >
                  {tx("signOut")}
                </MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>
    </header>
  );
}
