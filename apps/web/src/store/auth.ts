import type { AuthResponse, User } from "@stratum/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Epoch ms when the access token expires. */
  expiresAt: number | null;
  setSession: (auth: AuthResponse) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      setSession: (auth) =>
        set({
          user: auth.user,
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          expiresAt: Date.now() + auth.expiresIn * 1000,
        }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null, expiresAt: null }),
    }),
    { name: "fathom-auth-v1" },
  ),
);

export const isAuthenticated = (): boolean => Boolean(useAuthStore.getState().refreshToken);
