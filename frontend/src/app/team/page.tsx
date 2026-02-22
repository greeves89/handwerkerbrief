"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  UserPlus,
  X,
  CheckCircle,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { teamApi } from "@/lib/api";

interface TeamInvite {
  id: number;
  email: string;
  role: string;
  accepted: boolean;
  created_at: string;
  expires_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  member: "Mitarbeiter",
  admin: "Administrator",
};

export default function TeamPage() {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isSending, setIsSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await teamApi.listInvites();
      setInvites(res.data);
    } catch {
      setError("Einladungen konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await teamApi.invite(inviteEmail.trim(), inviteRole);
      setSuccessMsg(`Einladung an ${inviteEmail} gesendet.`);
      setInviteEmail("");
      setInviteRole("member");
      setShowModal(false);
      await loadInvites();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "Einladung konnte nicht gesendet werden.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Einladung wirklich loeschen?")) return;
    setDeletingId(id);
    try {
      await teamApi.deleteInvite(id);
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
    } catch {
      setError("Einladung konnte nicht geloescht werden.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title="Team"
            subtitle="Mitarbeiter einladen und verwalten"
            actions={
              <button
                onClick={() => { setShowModal(true); setError(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Einladen
              </button>
            }
          />

          <main className="flex-1 overflow-y-auto p-6">
            {/* Success banner */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm"
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
                >
                  <X className="w-4 h-4 shrink-0" />
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Section: Einladungen */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Einladungen</h2>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {invites.length}
                </span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                </div>
              ) : invites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-foreground font-medium mb-1">Noch keine Einladungen</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Laden Sie Mitarbeiter ein, um gemeinsam zu arbeiten.
                  </p>
                  <button
                    onClick={() => { setShowModal(true); setError(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                  >
                    <UserPlus className="w-4 h-4" />
                    Einladen
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {invites.map((invite, index) => (
                    <motion.div
                      key={invite.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-accent/40 transition-colors"
                    >
                      {/* Icon */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>

                      {/* Email + role */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {invite.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Eingeladen am {formatDate(invite.created_at)}
                        </p>
                      </div>

                      {/* Role badge */}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          invite.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {ROLE_LABELS[invite.role] ?? invite.role}
                      </span>

                      {/* Status badge */}
                      {invite.accepted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle className="w-3 h-3" />
                          Angenommen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Ausstehend
                        </span>
                      )}

                      {/* Cancel button (only for pending invites) */}
                      {!invite.accepted && (
                        <button
                          onClick={() => handleDelete(invite.id)}
                          disabled={deletingId === invite.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Einladung zurueckziehen"
                        >
                          {deletingId === invite.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Future work note */}
            <div className="mt-6 px-4 py-3 bg-secondary/60 border border-border rounded-xl text-sm text-muted-foreground">
              <strong className="text-foreground">Hinweis:</strong> Team-Mitglieder koennen sich
              mit ihrem eigenen Konto anmelden. Die gemeinsame Datenverwaltung (geteilte Kunden,
              Rechnungen etc.) ist in Kuerze verfuegbar.
            </div>
          </main>
        </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-0 flex items-center justify-center z-50 px-4"
            >
              <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Mitarbeiter einladen
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Einladungslink wird per E-Mail versendet
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <X className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      E-Mail-Adresse
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                        placeholder="mitarbeiter@beispiel.de"
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Rolle
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="member">Mitarbeiter</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={isSending || !inviteEmail.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Einladung senden
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AuthGuard>
  );
}
