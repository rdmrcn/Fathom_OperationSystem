import { FolderKanban, Inbox, LayoutDashboard, ListTodo, Sunrise } from "lucide-react";
import { NavLink } from "react-router";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const t = useT();
  const items = [
    { to: "/", label: t("navHome"), icon: LayoutDashboard, end: true },
    { to: "/today", label: t("navToday"), icon: Sunrise },
    { to: "/projects", label: t("navProjects"), icon: FolderKanban },
    { to: "/tasks", label: t("navTasks"), icon: ListTodo },
    { to: "/inbox", label: t("navInbox"), icon: Inbox },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 px-1 py-1 backdrop-blur md:hidden">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium", isActive ? "text-accent" : "text-muted")
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
