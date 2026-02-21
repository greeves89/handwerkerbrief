import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "./api";
import { User } from "./types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/login", { email, password });
          set({ user: res.data, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },
      register: async (name, email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post("/auth/register", { name, email, password });
          set({ user: res.data, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          set({ user: null });
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      },
      fetchMe: async () => {
        try {
          const res = await api.get("/users/me");
          set({ user: res.data });
        } catch {
          set({ user: null });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
