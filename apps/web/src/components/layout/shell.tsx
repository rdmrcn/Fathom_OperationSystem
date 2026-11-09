import { Outlet } from "react-router";
import { FloatingAssistant } from "@/components/assistant/floating";
import { useT } from "@/i18n";
import { MobileNav } from "./mobile-nav";
import { ShortcutsHelp } from "./shortcuts";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function Shell() {
  const t = useT();
  return (
    <div className="flex min-h-svh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        {t("skip")}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="flex-1 overflow-x-hidden px-4 py-6 pb-20 sm:px-6 lg:px-8 md:pb-6">
          <Outlet />
        </main>
        <MobileNav />
      </div>
      <FloatingAssistant />
      <ShortcutsHelp />
    </div>
  );
}
