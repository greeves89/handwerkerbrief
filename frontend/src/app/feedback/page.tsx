"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import api from "@/lib/api";
import { Feedback } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  general: "Allgemein",
  bug: "Fehler",
  feature: "Feature-Wunsch",
};

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-warning", label: "Ausstehend" },
  approved: { icon: CheckCircle, color: "text-success", label: "Bestaetigt" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Abgelehnt" },
};

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get("/feedback").then((r) => {
      setFeedbacks(r.data);
      setIsLoading(false);
    });
  }, []);

  const handleSave = async (data: { type: string; title: string; message: string }) => {
    const res = await api.post("/feedback", data);
    setFeedbacks((prev) => [res.data, ...prev]);
    setShowForm(false);
  };

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Feedback"
            subtitle="Teilen Sie Ihre Meinung und Verbesserungsvorschlaege"
            actions={
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Feedback senden
              </button>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-medium mb-1">Noch kein Feedback gesendet</p>
                <p className="text-sm text-muted-foreground mb-4">Helfen Sie uns, HandwerkerBrief zu verbessern</p>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  Feedback senden
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbacks.map((fb, index) => {
                  const statusConf = statusConfig[fb.status];
                  const StatusIcon = statusConf.icon;
                  return (
                    <motion.div
                      key={fb.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-card border border-border rounded-xl p-5"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              {typeLabels[fb.type]}
                            </span>
                            <span className={cn("flex items-center gap-1 text-xs font-medium", statusConf.color)}>
                              <StatusIcon className="w-3 h-3" />
                              {statusConf.label}
                            </span>
                          </div>
                          <h3 className="font-medium text-foreground">{fb.title}</h3>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(fb.created_at)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{fb.message}</p>
                      {fb.admin_response && (
                        <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                          <p className="text-xs font-medium text-primary mb-1">Antwort vom Support:</p>
                          <p className="text-sm text-foreground">{fb.admin_response}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
      {showForm && (
        <FeedbackForm onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}
    </AuthGuard>
    </MobileNavProvider>
  );
}
