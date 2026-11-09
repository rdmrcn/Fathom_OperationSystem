import type { ProjectStatus, Role, TaskPriority, TaskStatus, TaskType } from "@stratum/shared";

export interface SeedUser {
  email: string;
  name: string;
  role: Role;
  jobTitle: string;
  avatarColor: string;
}

export interface SeedTask {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  /** Index into `seedUsers`, or null for unassigned. */
  assignee: number | null;
  /** Days relative to today (negative = past). */
  due?: number;
  estimate?: number;
  labels?: string[];
  /** Days ago the task was created. */
  createdDaysAgo: number;
  /** Days ago the task was completed (only when status is done). */
  completedDaysAgo?: number;
  comments?: { author: number; body: string; daysAgo: number }[];
}

export interface SeedProject {
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  lead: number;
  members: number[];
  startDaysAgo: number;
  targetInDays: number | null;
  tasks: SeedTask[];
}

export const seedUsers: SeedUser[] = [
  { email: "admin@fathom.dev", name: "Reha Demircan", role: "admin", jobTitle: "Engineering Manager", avatarColor: "#6366f1" },
  { email: "manager@fathom.dev", name: "Elif Kaya", role: "manager", jobTitle: "Product Manager", avatarColor: "#ec4899" },
  { email: "member@fathom.dev", name: "Mert Yıldız", role: "member", jobTitle: "Frontend Engineer", avatarColor: "#14b8a6" },
  { email: "zeynep@fathom.dev", name: "Zeynep Arslan", role: "member", jobTitle: "Backend Engineer", avatarColor: "#f59e0b" },
  { email: "can@fathom.dev", name: "Can Öztürk", role: "member", jobTitle: "DevOps Engineer", avatarColor: "#8b5cf6" },
  { email: "selin@fathom.dev", name: "Selin Doğan", role: "member", jobTitle: "QA Engineer", avatarColor: "#ef4444" },
  { email: "emre@fathom.dev", name: "Emre Şahin", role: "manager", jobTitle: "Data Engineer", avatarColor: "#0ea5e9" },
  { email: "ayse@fathom.dev", name: "Ayşe Çelik", role: "member", jobTitle: "UX Designer", avatarColor: "#22c55e" },
];

export const seedProjects: SeedProject[] = [
  {
    key: "PAY",
    name: "Payments Platform",
    description:
      "Rebuild the checkout and payment orchestration service: multi-provider routing, 3-D Secure, refunds and reconciliation reports.",
    status: "active",
    color: "#6366f1",
    lead: 1,
    members: [0, 1, 2, 3, 5],
    startDaysAgo: 45,
    targetInDays: 30,
    tasks: [
      { title: "Design payment provider abstraction", description: "Define the PaymentProvider interface covering authorise, capture, refund and webhook verification.", status: "done", priority: "high", type: "feature", assignee: 3, estimate: 12, labels: ["architecture"], createdDaysAgo: 44, completedDaysAgo: 38, comments: [{ author: 1, body: "Please keep idempotency keys in the interface from day one.", daysAgo: 42 }, { author: 3, body: "Added `idempotencyKey` to every mutating call.", daysAgo: 40 }] },
      { title: "Implement Stripe adapter", status: "done", priority: "high", type: "feature", assignee: 3, estimate: 16, labels: ["backend", "stripe"], createdDaysAgo: 40, completedDaysAgo: 30 },
      { title: "Implement iyzico adapter for TR cards", status: "done", priority: "high", type: "feature", assignee: 3, estimate: 16, labels: ["backend"], createdDaysAgo: 38, completedDaysAgo: 24 },
      { title: "Checkout page: new card form with validation", status: "done", priority: "medium", type: "feature", assignee: 2, estimate: 10, labels: ["frontend"], createdDaysAgo: 36, completedDaysAgo: 22 },
      { title: "3-D Secure challenge flow", description: "Handle the redirect and iframe challenge flows, including timeouts and user cancellation.", status: "in_review", priority: "critical", type: "feature", assignee: 3, due: 2, estimate: 20, labels: ["backend", "security"], createdDaysAgo: 20, comments: [{ author: 5, body: "Cancellation path still returns a 500 when the provider times out.", daysAgo: 2 }] },
      { title: "Refund API and admin UI", status: "in_progress", priority: "high", type: "feature", assignee: 2, due: 6, estimate: 14, labels: ["frontend", "backend"], createdDaysAgo: 15 },
      { title: "Webhook signature verification fails for retried events", description: "Retried webhooks carry a different timestamp header; our verifier rejects them as replayed.", status: "in_progress", priority: "critical", type: "bug", assignee: 3, due: -1, estimate: 4, labels: ["bug", "webhooks"], createdDaysAgo: 4, comments: [{ author: 1, body: "This blocks the release — can we hotfix today?", daysAgo: 1 }] },
      { title: "Daily reconciliation report job", status: "todo", priority: "medium", type: "feature", assignee: 6, due: 12, estimate: 12, labels: ["data", "reports"], createdDaysAgo: 10 },
      { title: "Load test payment authorisation at 500 rps", status: "todo", priority: "high", type: "chore", assignee: 4, due: 9, estimate: 8, labels: ["performance"], createdDaysAgo: 8 },
      { title: "Currency rounding mismatch on multi-item carts", description: "Totals are off by 1 kuruş when three or more items have VAT applied per line.", status: "todo", priority: "high", type: "bug", assignee: 2, due: -3, estimate: 3, labels: ["bug"], createdDaysAgo: 6 },
      { title: "PCI DSS self-assessment questionnaire", status: "backlog", priority: "medium", type: "chore", assignee: 0, due: 25, estimate: 6, labels: ["compliance"], createdDaysAgo: 12 },
      { title: "Evaluate Apple Pay / Google Pay wallets", status: "backlog", priority: "low", type: "research", assignee: null, estimate: 8, labels: ["research"], createdDaysAgo: 9 },
      { title: "Regression suite for refund edge cases", status: "todo", priority: "medium", type: "chore", assignee: 5, due: 8, estimate: 10, labels: ["qa"], createdDaysAgo: 5 },
      { title: "Fix double-submit on slow network", status: "done", priority: "high", type: "bug", assignee: 2, estimate: 2, labels: ["bug", "frontend"], createdDaysAgo: 13, completedDaysAgo: 11 },
    ],
  },
  {
    key: "OPS",
    name: "Cloud Operations",
    description: "Platform reliability work: observability, cost controls, on-call tooling and the Kubernetes upgrade.",
    status: "active",
    color: "#0ea5e9",
    lead: 4,
    members: [0, 4, 3, 6],
    startDaysAgo: 60,
    targetInDays: 50,
    tasks: [
      { title: "Upgrade production cluster to Kubernetes 1.31", status: "in_progress", priority: "critical", type: "chore", assignee: 4, due: 5, estimate: 24, labels: ["kubernetes"], createdDaysAgo: 18 },
      { title: "Alert fatigue: tune noisy CPU alerts", status: "done", priority: "medium", type: "chore", assignee: 4, estimate: 4, labels: ["observability"], createdDaysAgo: 30, completedDaysAgo: 26 },
      { title: "Centralised structured logging with OpenTelemetry", status: "in_review", priority: "high", type: "feature", assignee: 3, due: 4, estimate: 16, labels: ["observability"], createdDaysAgo: 22 },
      { title: "Monthly cloud cost dashboard", status: "todo", priority: "medium", type: "feature", assignee: 6, due: 14, estimate: 10, labels: ["finops", "reports"], createdDaysAgo: 7 },
      { title: "Database backups not verified since March", description: "Restore drills have not been run; automate a weekly restore into a scratch instance.", status: "todo", priority: "critical", type: "bug", assignee: 4, due: -5, estimate: 6, labels: ["risk", "sql-server"], createdDaysAgo: 9, comments: [{ author: 0, body: "Treat this as top priority this sprint.", daysAgo: 3 }] },
      { title: "On-call handbook and runbooks", status: "backlog", priority: "low", type: "chore", assignee: null, estimate: 8, labels: ["docs"], createdDaysAgo: 20 },
      { title: "Right-size staging environment", status: "done", priority: "low", type: "chore", assignee: 4, estimate: 3, labels: ["finops"], createdDaysAgo: 16, completedDaysAgo: 9 },
      { title: "Secrets rotation automation", status: "backlog", priority: "high", type: "feature", assignee: 3, due: 28, estimate: 12, labels: ["security"], createdDaysAgo: 4 },
      { title: "Evaluate managed Prometheus vs self-hosted", status: "done", priority: "low", type: "research", assignee: 6, estimate: 6, labels: ["research"], createdDaysAgo: 35, completedDaysAgo: 29 },
    ],
  },
  {
    key: "MOB",
    name: "Mobile App 2.0",
    description: "React Native rewrite of the customer app with offline mode, biometric login and a redesigned onboarding.",
    status: "active",
    color: "#ec4899",
    lead: 1,
    members: [1, 2, 5, 7, 0],
    startDaysAgo: 25,
    targetInDays: 75,
    tasks: [
      { title: "Onboarding redesign: wireframes", status: "done", priority: "high", type: "research", assignee: 7, estimate: 10, labels: ["design"], createdDaysAgo: 24, completedDaysAgo: 17 },
      { title: "Onboarding redesign: high-fidelity screens", status: "in_review", priority: "high", type: "feature", assignee: 7, due: 3, estimate: 16, labels: ["design"], createdDaysAgo: 16 },
      { title: "Biometric login (Face ID / fingerprint)", status: "in_progress", priority: "high", type: "feature", assignee: 2, due: 10, estimate: 18, labels: ["mobile", "security"], createdDaysAgo: 12 },
      { title: "Offline cache for order history", status: "todo", priority: "medium", type: "feature", assignee: 2, due: 20, estimate: 20, labels: ["mobile"], createdDaysAgo: 8 },
      { title: "Crash on Android 14 when rotating the cart screen", status: "todo", priority: "critical", type: "bug", assignee: null, due: 1, estimate: 4, labels: ["bug", "android"], createdDaysAgo: 2 },
      { title: "Set up Detox end-to-end tests", status: "backlog", priority: "medium", type: "chore", assignee: 5, estimate: 12, labels: ["qa"], createdDaysAgo: 6 },
      { title: "Push notification preferences", status: "backlog", priority: "low", type: "feature", assignee: null, estimate: 8, labels: ["mobile"], createdDaysAgo: 5 },
      { title: "App Store / Play Store listing assets", status: "backlog", priority: "low", type: "chore", assignee: 7, due: 60, estimate: 6, labels: ["design", "release"], createdDaysAgo: 3 },
      { title: "Accessibility audit of new screens", status: "todo", priority: "medium", type: "chore", assignee: 5, due: 15, estimate: 8, labels: ["a11y", "qa"], createdDaysAgo: 4 },
    ],
  },
  {
    key: "DATA",
    name: "Analytics Warehouse",
    description: "SQL Server based analytics warehouse: ELT pipelines, dimensional model and executive dashboards.",
    status: "on_hold",
    color: "#f59e0b",
    lead: 6,
    members: [6, 3, 0],
    startDaysAgo: 90,
    targetInDays: null,
    tasks: [
      { title: "Dimensional model for orders and customers", status: "done", priority: "high", type: "feature", assignee: 6, estimate: 20, labels: ["data-model"], createdDaysAgo: 80, completedDaysAgo: 60 },
      { title: "Nightly ELT from production replica", status: "done", priority: "high", type: "feature", assignee: 6, estimate: 24, labels: ["pipeline"], createdDaysAgo: 70, completedDaysAgo: 48 },
      { title: "Columnstore indexes on fact tables", status: "done", priority: "medium", type: "chore", assignee: 3, estimate: 6, labels: ["sql-server", "performance"], createdDaysAgo: 50, completedDaysAgo: 45 },
      { title: "Executive revenue dashboard", status: "in_progress", priority: "medium", type: "feature", assignee: 6, due: 30, estimate: 16, labels: ["reports"], createdDaysAgo: 40 },
      { title: "Data quality checks and alerting", status: "backlog", priority: "medium", type: "feature", assignee: null, estimate: 12, labels: ["pipeline"], createdDaysAgo: 30 },
      { title: "Slowly changing dimensions for customer attributes", status: "backlog", priority: "low", type: "research", assignee: 6, estimate: 8, labels: ["data-model"], createdDaysAgo: 28 },
    ],
  },
  {
    key: "WEB",
    name: "Marketing Website",
    description: "Rebuilt the public site on Next.js with a headless CMS and localisation.",
    status: "completed",
    color: "#22c55e",
    lead: 2,
    members: [2, 7, 1],
    startDaysAgo: 120,
    targetInDays: -20,
    tasks: [
      { title: "Headless CMS integration", status: "done", priority: "high", type: "feature", assignee: 2, estimate: 16, labels: ["frontend"], createdDaysAgo: 110, completedDaysAgo: 90 },
      { title: "Localisation (TR/EN/DE)", status: "done", priority: "medium", type: "feature", assignee: 2, estimate: 12, labels: ["i18n"], createdDaysAgo: 95, completedDaysAgo: 70 },
      { title: "Design system tokens", status: "done", priority: "medium", type: "feature", assignee: 7, estimate: 10, labels: ["design"], createdDaysAgo: 100, completedDaysAgo: 85 },
      { title: "Lighthouse performance to 95+", status: "done", priority: "medium", type: "chore", assignee: 2, estimate: 8, labels: ["performance"], createdDaysAgo: 60, completedDaysAgo: 40 },
      { title: "Launch checklist and DNS cutover", status: "done", priority: "critical", type: "chore", assignee: 1, estimate: 4, labels: ["release"], createdDaysAgo: 35, completedDaysAgo: 21 },
    ],
  },
];

export const seedConversation = {
  title: "Overdue work this week",
  messages: [
    { role: "user" as const, content: "Which tasks are overdue right now?" },
    {
      role: "assistant" as const,
      content:
        "There are 3 overdue open tasks:\n\n- **PAY-7** Webhook signature verification fails for retried events (critical, Zeynep Arslan)\n- **PAY-10** Currency rounding mismatch on multi-item carts (high, Mert Yıldız)\n- **OPS-5** Database backups not verified since March (critical, Can Öztürk)\n\nThe two critical ones are in Payments Platform and Cloud Operations. Want me to summarise either project?",
    },
  ],
};
