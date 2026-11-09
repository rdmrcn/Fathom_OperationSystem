import { Activity, BarChart3, CalendarDays, FolderKanban, Inbox, LayoutDashboard, ListTodo, PanelLeftClose, PanelLeftOpen, Sparkles, Sunrise, Users } from "lucide-react";
import { NavLink } from "react-router";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui";

export function Sidebar() {
  const t = useT();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const nav = [
    { to: "/", label: t("navDashboard"), icon: LayoutDashboard, end: true },
    { to: "/today", label: t("navToday"), icon: Sunrise },
    { to: "/projects", label: t("navProjects"), icon: FolderKanban },
    { to: "/tasks", label: t("navTasks"), icon: ListTodo },
    { to: "/inbox", label: t("navInbox"), icon: Inbox },
    { to: "/calendar", label: t("navCalendar"), icon: CalendarDays },
    { to: "/reports", label: t("navReports"), icon: BarChart3 },
    { to: "/team", label: t("navTeam"), icon: Users },
    { to: "/activity", label: t("navActivity"), icon: Activity },
    { to: "/assistant", label: t("navAssistant"), icon: Sparkles },
  ];

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border bg-surface/80 backdrop-blur-md transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-[232px]",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2.5 px-3", collapsed && "justify-center")}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-fg">F</span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">{t("brand")}</div>
            <div className="truncate text-[11px] text-subtle">{t("brandTag")}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition",
                collapsed && "justify-center px-0",
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
              )
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={collapsed ? t("expand") : t("collapse")}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span className="flex-1 text-left">{t("collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}
