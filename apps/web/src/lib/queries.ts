import type {
  Activity,
  ApplyBreakdownInput,
  AssistantCapabilities,
  BreakdownRequest,
  BreakdownResponse,
  ChatRequest,
  ChatResponse,
  Comment,
  Conversation,
  ConversationDetail,
  CreateProjectInput,
  CreateTaskInput,
  DashboardStats,
  MoveTaskInput,
  Paginated,
  Project,
  ProjectMember,
  ProjectSummaryResponse,
  Role,
  Task,
  UpdateProjectInput,
  UpdateProfileInput,
  UpdateTaskInput,
  User,
} from "@stratum/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, toQuery } from "./api";
import { useAuthStore } from "@/store/auth";

export const keys = {
  dashboard: ["dashboard"] as const,
  projects: (params?: Record<string, unknown>) => ["projects", params ?? {}] as const,
  project: (id: number) => ["project", id] as const,
  members: (id: number) => ["project", id, "members"] as const,
  board: (projectId: number) => ["board", projectId] as const,
  tasks: (params: Record<string, unknown>) => ["tasks", params] as const,
  task: (id: number) => ["task", id] as const,
  comments: (id: number) => ["task", id, "comments"] as const,
  users: ["users"] as const,
  activity: (params: Record<string, unknown>) => ["activity", params] as const,
  capabilities: ["assistant", "capabilities"] as const,
  conversations: ["assistant", "conversations"] as const,
  conversation: (id: number) => ["assistant", "conversation", id] as const,
  summary: (projectId: number) => ["assistant", "summary", projectId] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: () => api<DashboardStats>("/api/dashboard"), refetchInterval: 60_000 });
}

export function useProjects(params: { status?: string; mine?: boolean } = {}) {
  return useQuery({ queryKey: keys.projects(params), queryFn: () => api<Project[]>(`/api/projects${toQuery(params)}`) });
}

export function useProject(id: number | undefined) {
  return useQuery({ queryKey: keys.project(id ?? 0), queryFn: () => api<Project>(`/api/projects/${id}`), enabled: Boolean(id) });
}

export function useProjectMembers(id: number | undefined) {
  return useQuery({ queryKey: keys.members(id ?? 0), queryFn: () => api<ProjectMember[]>(`/api/projects/${id}/members`), enabled: Boolean(id) });
}

export function useBoard(projectId: number | undefined) {
  return useQuery({ queryKey: keys.board(projectId ?? 0), queryFn: () => api<Task[]>(`/api/tasks/board/${projectId}`), enabled: Boolean(projectId) });
}

export function useTasks(params: Record<string, string | number | boolean | undefined>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.tasks(params),
    queryFn: () => api<Paginated<Task>>(`/api/tasks${toQuery(params)}`),
    placeholderData: (prev) => prev,
    enabled: options?.enabled ?? true,
  });
}

export function useTask(id: number | undefined) {
  return useQuery({ queryKey: keys.task(id ?? 0), queryFn: () => api<Task>(`/api/tasks/${id}`), enabled: Boolean(id) });
}

export function useComments(taskId: number | undefined) {
  return useQuery({ queryKey: keys.comments(taskId ?? 0), queryFn: () => api<Comment[]>(`/api/tasks/${taskId}/comments`), enabled: Boolean(taskId) });
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => api<User[]>("/api/users"), staleTime: 60_000 });
}

export function useActivity(params: { projectId?: number; taskId?: number; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: keys.activity(params), queryFn: () => api<Paginated<Activity>>(`/api/activity${toQuery(params)}`), placeholderData: (prev) => prev });
}

/** Invalidates every query that can be affected by a task or project change. */
function useInvalidateWorkspace() {
  const qc = useQueryClient();
  return (projectId?: number, taskId?: number) => {
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["projects"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
    void qc.invalidateQueries({ queryKey: keys.dashboard });
    if (projectId) {
      void qc.invalidateQueries({ queryKey: keys.board(projectId) });
      void qc.invalidateQueries({ queryKey: keys.project(projectId) });
      void qc.invalidateQueries({ queryKey: keys.summary(projectId) });
    }
    if (taskId) void qc.invalidateQueries({ queryKey: keys.task(taskId) });
  };
}

export function useCreateTask() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api<Task>("/api/tasks", { method: "POST", body: input }),
    onSuccess: (task) => invalidate(task.projectId, task.id),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTaskInput }) => api<Task>(`/api/tasks/${id}`, { method: "PATCH", body: input }),
    onSuccess: (task) => invalidate(task.projectId, task.id),
  });
}

export function useMoveTask(projectId: number) {
  const qc = useQueryClient();
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: MoveTaskInput }) => api<Task>(`/api/tasks/${id}/move`, { method: "POST", body: input }),
    // Optimistic update so the board does not flicker while the server reorders.
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: keys.board(projectId) });
      const previous = qc.getQueryData<Task[]>(keys.board(projectId));
      if (previous) {
        const order = new Map(input.orderedIds.map((taskId, i) => [taskId, (i + 1) * 1000]));
        qc.setQueryData<Task[]>(
          keys.board(projectId),
          previous.map((t) => (t.id === id ? { ...t, status: input.status, position: order.get(id) ?? t.position } : order.has(t.id) ? { ...t, position: order.get(t.id)! } : t)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(keys.board(projectId), context.previous);
    },
    onSettled: (task) => invalidate(projectId, task?.id),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: ({ id }: { id: number; projectId: number }) => api<void>(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: (_data, vars) => invalidate(vars.projectId),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: number; body: string; projectId: number }) => api<Comment[]>(`/api/tasks/${taskId}/comments`, { method: "POST", body: { body } }),
    onSuccess: (comments, vars) => {
      qc.setQueryData(keys.comments(vars.taskId), comments);
      invalidate(vars.projectId, vars.taskId);
    },
  });
}

export function useCreateProject() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api<Project>("/api/projects", { method: "POST", body: input }),
    onSuccess: (project) => invalidate(project.id),
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateProjectInput }) => api<Project>(`/api/projects/${id}`, { method: "PATCH", body: input }),
    onSuccess: (project) => invalidate(project.id),
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });
}

export function useProjectMembership(projectId: number) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (userId: number) => api<ProjectMember[]>(`/api/projects/${projectId}/members`, { method: "POST", body: { userId } }),
    onSuccess: (members) => {
      qc.setQueryData(keys.members(projectId), members);
      void qc.invalidateQueries({ queryKey: keys.project(projectId) });
    },
  });
  const remove = useMutation({
    mutationFn: (userId: number) => api<ProjectMember[]>(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (members) => {
      qc.setQueryData(keys.members(projectId), members);
      void qc.invalidateQueries({ queryKey: keys.project(projectId) });
    },
  });
  return { add, remove };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api<User>("/api/users/me", { method: "PATCH", body: input }),
    onSuccess: (user) => {
      setUser(user);
      void qc.invalidateQueries({ queryKey: keys.users });
    },
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Role }) => api<User>(`/api/users/${userId}/role`, { method: "PATCH", body: { role } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) => api<User>(`/api/users/${userId}/active`, { method: "PATCH", body: { isActive } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.users }),
  });
}

// ---- Assistant -----------------------------------------------------------

export function useAssistantCapabilities() {
  return useQuery({ queryKey: keys.capabilities, queryFn: () => api<AssistantCapabilities>("/api/assistant/capabilities"), staleTime: 5 * 60_000 });
}

export function useConversations() {
  return useQuery({ queryKey: keys.conversations, queryFn: () => api<Conversation[]>("/api/assistant/conversations") });
}

export function useConversation(id: number | null) {
  return useQuery({ queryKey: keys.conversation(id ?? 0), queryFn: () => api<ConversationDetail>(`/api/assistant/conversations/${id}`), enabled: Boolean(id) });
}

export function useSendMessage() {
  const qc = useQueryClient();
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: (input: ChatRequest) => api<ChatResponse>("/api/assistant/chat", { method: "POST", body: input }),
    onSuccess: (data) => {
      qc.setQueryData<ConversationDetail>(keys.conversation(data.conversation.id), (prev) => ({
        ...data.conversation,
        messages: [...(prev?.messages.filter((m) => m.id > 0) ?? []), data.userMessage, data.assistantMessage],
      }));
      void qc.invalidateQueries({ queryKey: keys.conversations });
      // The assistant may have created tasks.
      if (data.assistantMessage.toolTrace.some((t) => t.tool === "create_task")) invalidate();
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/assistant/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.conversations }),
  });
}

export function useBreakdown() {
  return useMutation({ mutationFn: (input: BreakdownRequest) => api<BreakdownResponse>("/api/assistant/breakdown", { method: "POST", body: input }) });
}

export function useApplyBreakdown() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: (input: ApplyBreakdownInput) => api<Task[]>("/api/assistant/breakdown/apply", { method: "POST", body: input }),
    onSuccess: (_tasks, vars) => invalidate(vars.projectId),
  });
}

export function useProjectSummary(projectId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.summary(projectId ?? 0),
    queryFn: () => api<ProjectSummaryResponse>(`/api/assistant/projects/${projectId}/summary`),
    enabled: Boolean(projectId) && enabled,
    staleTime: 2 * 60_000,
  });
}
