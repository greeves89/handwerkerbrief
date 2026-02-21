"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, FileText, TrendingUp, MessageSquare, Shield } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { StatsCard } from "@/components/dashboard/stats-card";
import api from "@/lib/api";
import { AdminStats } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/stats").then((r) => {
      setStats(r.data);
      setIsLoading(false);
    });
  }, []);

  return (
    <AuthGuard adminOnly>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header title="Admin Dashboard" subtitle="System-Uebersicht und Verwaltung" />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatsCard title="Benutzer gesamt" value={stats.total_users} subtitle={`${stats.premium_users} Premium`} icon={Users} color="primary" index={0} />
                  <StatsCard title="Aktive Benutzer" value={stats.active_users} icon={Shield} color="success" index={1} />
                  <StatsCard title="Rechnungen gesamt" value={stats.total_invoices} icon={FileText} color="info" index={2} />
                  <StatsCard title="Gesamtumsatz (bezahlt)" value={formatCurrency(stats.total_revenue)} icon={TrendingUp} color="success" index={3} />
                </div>

                {stats.pending_feedback > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-warning/10 border border-warning/20 rounded-xl px-5 py-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-warning" />
                      <p className="text-sm font-medium text-warning">
                        {stats.pending_feedback} ausstehende Feedback-Nachrichten
                      </p>
                    </div>
                    <Link href="/admin/feedback" className="px-4 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning/90">
                      Anzeigen
                    </Link>
                  </motion.div>
                )}

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-4">
                  <Link href="/admin/users">
                    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all cursor-pointer group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="font-medium text-foreground">Benutzerverwaltung</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Benutzer verwalten, Abonnements aendern</p>
                    </div>
                  </Link>
                  <Link href="/admin/feedback">
                    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all cursor-pointer group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="font-medium text-foreground">Feedback verwalten</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">Feedback einsehen und beantworten</p>
                    </div>
                  </Link>
                </div>
              </>
            ) : null}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
