"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Receipt,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { StatusChart } from "@/components/dashboard/status-chart";
import { DocumentList } from "@/components/documents/document-list";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { Document } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [overdueDocs, setOverdueDocs] = useState<Document[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<Array<{ month: string; paid: number; open: number }>>([]);
  const [statusCounts, setStatusCounts] = useState({ draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 });
  const [stats, setStats] = useState({
    openInvoices: 0,
    openAmount: 0,
    paidThisMonth: 0,
    paidAmount: 0,
    totalCustomers: 0,
    revenueThisMonth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [docsRes, customersRes] = await Promise.all([
          api.get("/documents", { params: { type: "invoice", limit: 20 } }),
          api.get("/customers"),
        ]);

        const docs: Document[] = docsRes.data;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const openInvoices = docs.filter((d) => ["sent", "draft"].includes(d.status));
        const openAmount = openInvoices.reduce((s, d) => s + Number(d.total_amount), 0);

        const paidThisMonth = docs.filter(
          (d) => d.status === "paid" && new Date(d.updated_at) >= monthStart
        );
        const paidAmount = paidThisMonth.reduce((s, d) => s + Number(d.total_amount), 0);

        const overdue = docs.filter(
          (d) =>
            d.status !== "paid" &&
            d.status !== "cancelled" &&
            d.due_date &&
            new Date(d.due_date) < now
        );

        setStats({
          openInvoices: openInvoices.length,
          openAmount,
          paidThisMonth: paidThisMonth.length,
          paidAmount,
          totalCustomers: customersRes.data.length,
          revenueThisMonth: paidAmount,
        });
        setRecentDocs(docs.slice(0, 5));
        setOverdueDocs(overdue);

        // Monthly revenue chart (last 6 months)
        const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
        const monthly: Array<{ month: string; paid: number; open: number }> = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthly.push({ month: monthNames[d.getMonth()], paid: 0, open: 0 });
        }
        for (const doc of docs) {
          if (doc.type !== "invoice") continue;
          const docDate = new Date(doc.issue_date || doc.created_at);
          const mIdx = monthly.findIndex((m, idx) => {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
            return targetDate.getFullYear() === docDate.getFullYear() && targetDate.getMonth() === docDate.getMonth();
          });
          if (mIdx === -1) continue;
          const amount = Number(doc.total_amount);
          if (doc.status === "paid") monthly[mIdx].paid += amount;
          else if (doc.status !== "cancelled") monthly[mIdx].open += amount;
        }
        setMonthlyRevenue(monthly);

        // Status counts
        const counts = { draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 };
        for (const doc of docs) {
          if (doc.type !== "invoice") continue;
          const isOverdueDoc = doc.status !== "paid" && doc.status !== "cancelled" && doc.due_date && new Date(doc.due_date) < now;
          if (isOverdueDoc) counts.overdue++;
          else if (doc.status === "draft") counts.draft++;
          else if (doc.status === "sent") counts.sent++;
          else if (doc.status === "paid") counts.paid++;
          else if (doc.status === "cancelled") counts.cancelled++;
        }
        setStatusCounts(counts);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title={`Guten Tag, ${user?.name?.split(" ")[0]} !`}
            subtitle="Hier ist eine Uebersicht Ihrer Aktivitaeten"
          />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Premium upsell for free users */}
            {user?.subscription_tier === "free" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/10 border border-primary/20 rounded-xl px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-primary">Upgrade auf Premium</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unbegrenzte Rechnungen, DATEV-Export, Mahnwesen und mehr - nur 0,99 EUR/Monat
                  </p>
                </div>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap">
                  Jetzt upgraden
                </button>
              </motion.div>
            )}

            {/* Overdue alert */}
            {overdueDocs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-4 flex items-center gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {overdueDocs.length} ueberfaellige Rechnung{overdueDocs.length > 1 ? "en" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gesamtbetrag: {formatCurrency(overdueDocs.reduce((s, d) => s + Number(d.total_amount), 0))}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatsCard
                title="Offene Rechnungen"
                value={stats.openInvoices}
                subtitle={formatCurrency(stats.openAmount)}
                icon={Receipt}
                color="warning"
                index={0}
              />
              <StatsCard
                title="Bezahlt diesen Monat"
                value={stats.paidThisMonth}
                subtitle={formatCurrency(stats.paidAmount)}
                icon={CheckCircle2}
                color="success"
                index={1}
              />
              <StatsCard
                title="Umsatz diesen Monat"
                value={formatCurrency(stats.revenueThisMonth)}
                icon={TrendingUp}
                color="primary"
                index={2}
              />
              <StatsCard
                title="Kunden gesamt"
                value={stats.totalCustomers}
                icon={Users}
                color="info"
                index={3}
              />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Umsatz der letzten 6 Monate</h2>
                {isLoading ? (
                  <div className="h-40 rounded-lg bg-secondary/30 animate-pulse" />
                ) : (
                  <RevenueChart data={monthlyRevenue} />
                )}
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Rechnungen nach Status</h2>
                {isLoading ? (
                  <div className="h-32 rounded-lg bg-secondary/30 animate-pulse" />
                ) : (
                  <StatusChart
                    slices={[
                      { label: "Bezahlt", value: statusCounts.paid, color: "#10b981" },
                      { label: "Versendet", value: statusCounts.sent, color: "#3b82f6" },
                      { label: "Entwurf", value: statusCounts.draft, color: "#6b7280" },
                      { label: "Überfällig", value: statusCounts.overdue, color: "#ef4444" },
                      { label: "Storniert", value: statusCounts.cancelled, color: "#d1d5db" },
                    ]}
                  />
                )}
              </div>
            </div>

            {/* Recent invoices */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Aktuelle Rechnungen</h2>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <DocumentList documents={recentDocs} showActions={false} />
              )}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
    </MobileNavProvider>
  );
}
