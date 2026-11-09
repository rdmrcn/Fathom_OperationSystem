import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/i18n/messages";

type Theme = "dark" | "light";

interface UiState {
  theme: Theme;
  locale: Locale;
  sidebarCollapsed: boolean;
  assistantOpen: boolean;
  inboxSeenAt: string | null;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setAssistantOpen: (open: boolean) => void;
  markInboxSeen: () => void;
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("fathom-theme", theme);
  } catch {
    // Storage may be unavailable (private mode); the class is still applied.
  }
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      locale: "en",
      sidebarCollapsed: false,
      assistantOpen: false,
      inboxSeenAt: null,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setLocale: (locale) => {
        document.documentElement.lang = locale;
        set({ locale });
      },
      toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
      markInboxSeen: () => set({ inboxSeenAt: new Date().toISOString() }),
    }),
    {
      name: "fathom-ui-v1",
      partialize: (s) => ({ theme: s.theme, locale: s.locale, sidebarCollapsed: s.sidebarCollapsed, inboxSeenAt: s.inboxSeenAt }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
          document.documentElement.lang = state.locale ?? "en";
        }
      },
    },
  ),
);
