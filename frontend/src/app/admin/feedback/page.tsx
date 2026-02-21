"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
import { Feedback } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  general: "Allgemein",
  bug: "Fehler",
  feature: "Feature-Wunsch",
};

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<Feedback | null>(null);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("approved");
  const [filter, setFilter] = useState("pending");

  const load = async (s?: string) => {
    setIsLoading(true);
    const res = await api.get("/admin/feedback", { params: { status: s || filter } });
    setFeedbacks(res.data);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleRespond = async () => {
    if (!respondingTo) return;
    const res = await api.put(`/admin/feedback/${respondingTo.id}`, {
      status,
      admin_response: response,
    });
    setFeedbacks((prev) => prev.map((f) => (f.id === respondingTo.id ? res.data : f)));
    setRespondingTo(null);
    setResponse("");
  };

  return (
    <AuthGuard adminOnly>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header title="Feedback verwalten" subtitle="Kundenfeedback einsehen und beantworten" />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Filter tabs */}
            <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
              {["pending", "approved", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-medium transition-colors",
                    filter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "pending" ? "Ausstehend" : s === "approved" ? "Bestaetigt" : "Abgelehnt"}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Kein Feedback in dieser Kategorie</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbacks.map((fb, index) => (
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
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{typeLabels[fb.type]}</span>
                        </div>
                        <h3 className="font-medium text-foreground">{fb.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Benutzer #{fb.user_id} &bull; {formatDate(fb.created_at)}
                        </p>
                      </div>
                      {fb.status === "pending" && (
                        <button
                          onClick={() => { setRespondingTo(fb); setResponse(""); setStatus("approved"); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90"
                        >
                          <Send className="w-3 h-3" />
                          Antworten
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{fb.message}</p>
                    {fb.admin_response && (
                      <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-xs font-medium text-primary mb-1">Ihre Antwort:</p>
                        <p className="text-sm text-foreground">{fb.admin_response}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Response modal */}
      {respondingTo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">Auf Feedback antworten</h2>
            <p className="text-sm text-muted-foreground mb-4">"{respondingTo.title}"</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="approved">Bestaetigen</option>
                  <option value="rejected">Ablehnen</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Antwort</label>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
                  placeholder="Ihre Antwort an den Benutzer..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRespondingTo(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent">
                  Abbrechen
                </button>
                <button onClick={handleRespond} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                  Antwort senden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
