import type { ApiError, AuthResponse } from "@stratum/shared";
import { useAuthStore } from "@/store/auth";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** Field-level messages from validation errors, keyed by path. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as { path?: string; message?: string }[]) {
        if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
      }
    }
    return out;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

let refreshing: Promise<string | null> | null = null;

/** Single-flight refresh so concurrent 401s trigger one token rotation. */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refreshToken, setSession, clear } = useAuthStore.getState();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clear();
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      setSession(data);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function parseError(res: Response): Promise<ApiRequestError> {
  let payload: ApiError | null = null;
  try {
    payload = (await res.json()) as ApiError;
  } catch {
    payload = null;
  }
  const error = payload?.error;
  return new ApiRequestError(res.status, error?.code ?? "http_error", error?.message ?? `Request failed (${res.status})`, error?.details);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;
  const state = useAuthStore.getState();

  let token = state.accessToken;
  // Refresh proactively when the access token is about to expire.
  if (auth && token && state.expiresAt && state.expiresAt - Date.now() < 20_000) {
    token = (await refreshAccessToken()) ?? token;
  }

  const send = (bearer: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(auth && bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

  let res = await send(token);
  if (res.status === 401 && auth && useAuthStore.getState().refreshToken) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
    else throw new ApiRequestError(401, "session_expired", "Your session has expired. Please sign in again.");
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
