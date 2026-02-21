"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, Crown, ToggleLeft, ToggleRight } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
import { User } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/admin/users").then((r) => {
      setUsers(r.data);
      setIsLoading(false);
    });
  }, []);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
  });

  const toggleActive = async (id: number) => {
    const res = await api.put(`/admin/users/${id}/toggle-active`);
    setUsers((prev) => prev.map((u) => (u.id === id ? res.data : u)));
  };

  const updateSubscription = async (id: number, tier: string) => {
    const res = await api.put(`/admin/users/${id}/subscription`, { tier, months: 1 });
    setUsers((prev) => prev.map((u) => (u.id === id ? res.data : u)));
  };

  return (
    <AuthGuard adminOnly>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header title="Benutzerverwaltung" subtitle={`${users.length} Benutzer`} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Benutzer suchen..."
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-card border border-border rounded-xl px-5 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{user.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground text-sm">{user.name}</p>
                          {user.role === "admin" && (
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Admin</span>
                          )}
                          {user.subscription_tier === "premium" && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-warning/10 text-warning rounded-full">
                              <Crown className="w-3 h-3" />
                              Premium
                            </span>
                          )}
                          {!user.is_active && (
                            <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">Deaktiviert</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email} &bull; Seit {formatDate(user.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={user.subscription_tier}
                          onChange={(e) => updateSubscription(user.id, e.target.value)}
                          className="px-2 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                        </select>
                        {user.role !== "admin" && (
                          <button
                            onClick={() => toggleActive(user.id)}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              user.is_active
                                ? "bg-success/10 text-success hover:bg-success/20"
                                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                            )}
                          >
                            {user.is_active ? (
                              <><ToggleRight className="w-3.5 h-3.5" /> Aktiv</>
                            ) : (
                              <><ToggleLeft className="w-3.5 h-3.5" /> Inaktiv</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
