"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function AuthGuard({ children, adminOnly = false }: AuthGuardProps) {
  const { user, fetchMe } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      fetchMe().then(() => {
        const u = useAuthStore.getState().user;
        if (!u) {
          router.push("/login");
        } else if (adminOnly && u.role !== "admin") {
          router.push("/dashboard");
        }
      });
    } else if (adminOnly && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, adminOnly, router, fetchMe]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (adminOnly && user.role !== "admin") {
    return null;
  }

  return <>{children}</>;
}
