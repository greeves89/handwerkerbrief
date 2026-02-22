"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Plus,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Trash2,
  ChevronRight,
  Search,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { siteReportsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SiteReport {
  id: number;
  title: string;
  description?: string | null;
  location?: string | null;
  customer_id?: number | null;
  document_id?: number | null;
  status: string;
  report_date: string;
  customer_name?: string | null;
  signed_at?: string | null;
  defects: Array<{ description: string; severity: string; resolved: boolean }>;
  photos: Array<{ id: number; url: string; caption?: string | null }>;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  completed: "Abgeschlossen",
  signed: "Unterschrieben",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  signed: "bg-green-500/20 text-green-400 border-green-500/30",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SiteReportsPage() {
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await siteReportsApi.list();
      setReports(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.location || "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await siteReportsApi.create({
        title: newTitle.trim(),
        location: newLocation.trim() || undefined,
        description: newDescription.trim() || undefined,
      });
      setNewTitle("");
      setNewLocation("");
      setNewDescription("");
      setShowCreate(false);
      await load();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await siteReportsApi.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title="Baustellenabnahme"
            subtitle="Foto-Dokumentation & digitale Abnahme"
            actions={
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Neuer Bericht
              </button>
            }
          />

          <main className="flex-1 overflow-y-auto p-6">
            {/* Search */}
            <div className="relative mb-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Berichte suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Create modal */}
            <AnimatePresence>
              {showCreate && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
                  >
                    <h2 className="text-lg font-semibold text-foreground mb-4">Neuer Bericht</h2>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Titel *
                        </label>
                        <input
                          autoFocus
                          type="text"
                          placeholder="z.B. Badezimmer-Renovierung Musterstraße 1"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Ort / Adresse
                        </label>
                        <input
                          type="text"
                          placeholder="Musterstraße 1, 12345 Musterstadt"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Beschreibung
                        </label>
                        <textarea
                          placeholder="Kurze Beschreibung der Baustelle…"
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-5">
                      <button
                        onClick={() => setShowCreate(false)}
                        className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={creating || !newTitle.trim()}
                        className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {creating ? "Erstelle…" : "Erstellen"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Delete confirmation */}
            <AnimatePresence>
              {deleteId !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl"
                  >
                    <h2 className="text-base font-semibold text-foreground mb-2">Bericht löschen?</h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Dieser Vorgang kann nicht rückgängig gemacht werden.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteId(null)}
                        className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleDelete(deleteId)}
                        className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                      >
                        Löschen
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Camera className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground text-sm">
                  {search ? "Keine Berichte gefunden." : "Noch keine Berichte. Erstelle deinen ersten Bericht."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((report) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors group"
                  >
                    {/* Photo preview strip */}
                    {report.photos.length > 0 ? (
                      <div className="h-36 bg-muted/30 overflow-hidden">
                        <img
                          src={report.photos[0].url}
                          alt="Foto"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="h-36 bg-muted/20 flex items-center justify-center">
                        <Camera className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-medium text-foreground text-sm leading-snug line-clamp-2">
                          {report.title}
                        </h3>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] px-2 py-0.5 rounded-full border font-medium",
                            STATUS_COLORS[report.status] ?? STATUS_COLORS.draft
                          )}
                        >
                          {STATUS_LABELS[report.status] ?? report.status}
                        </span>
                      </div>

                      {report.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{report.location}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                        <Calendar className="w-3 h-3" />
                        {formatDate(report.report_date)}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          {report.photos.length} Fotos
                        </span>
                        {report.defects.length > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {report.defects.length} Mängel
                          </span>
                        )}
                        {report.status === "signed" && (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Unterschrieben
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/site-reports/${report.id}`}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          Öffnen
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => setDeleteId(report.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
