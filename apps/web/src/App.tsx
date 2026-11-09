import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Shell } from "./components/layout/shell";
import { LoginPage } from "./pages/login";
import { RegisterPage } from "./pages/register";
import { useAuthStore } from "./store/auth";

const DashboardPage = lazy(() => import("./pages/dashboard").then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import("./pages/projects").then((m) => ({ default: m.ProjectsPage })));
const ProjectBoardPage = lazy(() => import("./pages/project-board").then((m) => ({ default: m.ProjectBoardPage })));
const MyTasksPage = lazy(() => import("./pages/my-tasks").then((m) => ({ default: m.MyTasksPage })));
const TeamPage = lazy(() => import("./pages/team").then((m) => ({ default: m.TeamPage })));
const ActivityPage = lazy(() => import("./pages/activity").then((m) => ({ default: m.ActivityPage })));
const AssistantPage = lazy(() => import("./pages/assistant").then((m) => ({ default: m.AssistantPage })));
const SettingsPage = lazy(() => import("./pages/settings").then((m) => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import("./pages/reports").then((m) => ({ default: m.ReportsPage })));
const CalendarPage = lazy(() => import("./pages/calendar").then((m) => ({ default: m.CalendarPage })));
const TodayPage = lazy(() => import("./pages/today").then((m) => ({ default: m.TodayPage })));
const InboxPage = lazy(() => import("./pages/inbox").then((m) => ({ default: m.InboxPage })));

function ScreenLoader() {
  return <div className="grid min-h-[40vh] place-items-center text-sm text-muted">Loading…</div>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.refreshToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.refreshToken);
  if (token) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  const [ready, setReady] = useState(useAuthStore.persist.hasHydrated());
  useEffect(() => useAuthStore.persist.onFinishHydration(() => setReady(true)), []);
  if (!ready) return <div className="grid min-h-svh place-items-center text-sm text-muted">Loading Fathom…</div>;

  return (
    <Suspense fallback={<ScreenLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectBoardPage />} />
          <Route path="tasks" element={<MyTasksPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
