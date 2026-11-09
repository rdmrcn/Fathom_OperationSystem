export interface CommandItem {
  id: string;
  label: string;
  hint: string;
  to: string;
  keywords: string;
}

export const COMMANDS: CommandItem[] = [
  { id: "dash", label: "Dashboard", hint: "g h", to: "/", keywords: "dashboard home overview" },
  { id: "today", label: "Today", hint: "g t", to: "/today", keywords: "today standup briefing" },
  { id: "inbox", label: "Inbox", hint: "g i", to: "/inbox", keywords: "inbox activity notifications" },
  { id: "projects", label: "Projects", hint: "g p", to: "/projects", keywords: "projects boards" },
  { id: "tasks", label: "My tasks", hint: "g m", to: "/tasks", keywords: "tasks mine assigned" },
  { id: "calendar", label: "Calendar", hint: "g c", to: "/calendar", keywords: "calendar due dates" },
  { id: "reports", label: "Reports", hint: "g r", to: "/reports", keywords: "reports csv export" },
  { id: "team", label: "Team", hint: "g e", to: "/team", keywords: "team people members" },
  { id: "activity", label: "Activity", hint: "g f", to: "/activity", keywords: "activity feed" },
  { id: "assistant", label: "Assistant", hint: "g a", to: "/assistant", keywords: "assistant ai ask" },
  { id: "settings", label: "Settings", hint: "g s", to: "/settings", keywords: "settings profile" },
];

export const GOTO_PATHS: Record<string, string> = {
  h: "/",
  t: "/today",
  i: "/inbox",
  p: "/projects",
  m: "/tasks",
  c: "/calendar",
  r: "/reports",
  e: "/team",
  f: "/activity",
  a: "/assistant",
  s: "/settings",
};

export function matchCommands(query: string): CommandItem[] {
  const n = query.trim().toLowerCase();
  if (!n) return COMMANDS;
  return COMMANDS.filter((c) => c.label.toLowerCase().includes(n) || c.keywords.includes(n) || c.to.slice(1).startsWith(n));
}
