import type { Task } from "@stratum/shared";

function line(task: Task): string {
  const due = task.dueDate ? ` · due ${task.dueDate}` : "";
  const who = task.assignee?.name ? ` · ${task.assignee.name}` : " · unassigned";
  return `- ${task.key} ${task.title} (${task.priority}${due}${who})`;
}

function section(title: string, tasks: Task[], empty: string): string {
  return [`## ${title}`, tasks.length ? tasks.map(line).join("\n") : empty, ""].join("\n");
}

export function standupMarkdown(input: {
  date: string;
  name: string;
  overdue: Task[];
  dueToday: Task[];
  inProgress: Task[];
}): string {
  return [
    `# Fathom standup — ${input.date}`,
    `Prepared for ${input.name}.`,
    "",
    section("Overdue", input.overdue, "_Nothing overdue._"),
    section("Due today", input.dueToday, "_Nothing due today._"),
    section("In progress", input.inProgress, "_No in-progress work._"),
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}
