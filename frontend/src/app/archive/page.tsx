"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  Upload,
  Search,
  Download,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Filter,
  Calendar,
  Building2,
  Hash,
  Clock,
  CheckCircle2,
  X,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { archiveApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArchiveEntry {
  id: number;
  document_type: string;
  document_type_label: string;
  document_number?: string | null;
  document_date?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  counterparty?: string | null;
  original_filename?: string | null;
  file_size_bytes: number;
  mime_type: string;
  sha256_hash: string;
  archived_at: string;
  retention_until: string;
  year?: number | null;
  amount_cents?: number | null;
}

interface ArchiveStats {
  total_entries: number;
  total_size_bytes: number;
  by_type: Record<string, number>;
  by_year: Record<string, number>;
  oldest_entry?: string | null;
  newest_entry?: string | null;
}

interface DocType {
  value: string;
  label: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtEuro(cents: number | null | undefined) {
  if (cents == null) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

const TYPE_COLORS: Record<string, string> = {
  invoice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  offer: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  order_confirmation: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  delivery_note: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  incoming_invoice: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  contract: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  receipt: "bg-green-500/20 text-green-400 border-green-500/30",
  bank_statement: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

// ── Upload Modal ──────────────────────────────────────────────────────────────

function UploadModal({
  docTypes,
  onClose,
  onDone,
}: {
  docTypes: DocType[];
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("invoice");
  const [title, setTitle] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!file || !title.trim() || !docType) {
      setError("Bitte Datei, Belegart und Titel ausfüllen.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const meta: Record<string, string | number | undefined> = {
        document_type: docType,
        title: title.trim(),
        document_number: docNumber.trim() || undefined,
        document_date: docDate || undefined,
        counterparty: counterparty.trim() || undefined,
        description: description.trim() || undefined,
      };
      if (amountStr) {
        const euros = parseFloat(amountStr.replace(",", "."));
        if (!isNaN(euros)) meta.amount_cents = Math.round(euros * 100);
      }
      await archiveApi.upload(file, meta);
      onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Fehler beim Archivieren.");
    } finally {
      setUploading(false);
    }
  }

  return (
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
        className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Archive className="w-5 h-5 text-primary" />
            Beleg archivieren
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* File */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Datei *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-6 h-6 text-muted-foreground mb-2" />
              {file ? (
                <span className="text-sm font-medium text-foreground">{file.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">PDF, JPEG, PNG, TIFF, XML auswählen</span>
              )}
              {file && <span className="text-xs text-muted-foreground mt-1">{fmtBytes(file.size)}</span>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.xml,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {/* Belegart */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Belegart *</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {docTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Titel *</label>
            <input
              type="text"
              placeholder="z.B. Rechnung Elektriker März 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Two-col row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Belegnummer</label>
              <input
                type="text"
                placeholder="RE-2026-001"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Belegdatum</label>
              <input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Counterparty + amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Lieferant / Kunde</label>
              <input
                type="text"
                placeholder="Firma GmbH"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Betrag (€)</label>
              <input
                type="text"
                placeholder="1.234,56"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notiz</label>
            <textarea
              rows={2}
              placeholder="Optionale Notiz zum Beleg…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* GoBD notice */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              Dieser Beleg wird revisionssicher nach GoBD archiviert (SHA-256, 10 Jahre Aufbewahrungsfrist gem. § 147 AO).
              Nach der Archivierung kann er nicht mehr verändert oder gelöscht werden.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors">
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={uploading || !file || !title.trim()}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? "Archiviert…" : "Revisionssicher archivieren"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ArchivePage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterYear, setFilterYear] = useState("");

  // Verify state
  const [verifyResults, setVerifyResults] = useState<Record<number, { valid: boolean; reason: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, statsRes, typesRes] = await Promise.all([
        archiveApi.list({
          search: search || undefined,
          document_type: filterType || undefined,
          year: filterYear ? Number(filterYear) : undefined,
          limit: 100,
        }),
        archiveApi.stats(),
        archiveApi.documentTypes(),
      ]);
      setEntries(entriesRes.data);
      setStats(statsRes.data);
      setDocTypes(typesRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterYear]);

  useEffect(() => {
    load();
  }, [load]);

  async function verifyEntry(id: number) {
    try {
      const res = await archiveApi.verify(id);
      setVerifyResults((prev) => ({ ...prev, [id]: res.data }));
    } catch {
      setVerifyResults((prev) => ({ ...prev, [id]: { valid: false, reason: "Fehler bei der Verifikation" } }));
    }
  }

  const availableYears = stats
    ? Object.keys(stats.by_year).sort((a, b) => Number(b) - Number(a))
    : [];

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />

        <AnimatePresence>
          {showUpload && (
            <UploadModal
              docTypes={docTypes}
              onClose={() => setShowUpload(false)}
              onDone={() => { setShowUpload(false); load(); }}
            />
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="GoBD-Belegarchiv"
            subtitle="Revisionssichere Archivierung gem. § 147 AO (10 Jahre)"
            actions={
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Beleg archivieren
              </button>
            }
          />

          <main className="flex-1 overflow-y-auto p-6">

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Belege gesamt", value: stats.total_entries, icon: Archive },
                  { label: "Gespeichert", value: fmtBytes(stats.total_size_bytes), icon: FileText },
                  { label: "Ältester Beleg", value: fmtDate(stats.oldest_entry), icon: Calendar },
                  { label: "Neuester Beleg", value: fmtDate(stats.newest_entry), icon: Clock },
                ].map((s) => (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Suche nach Titel, Nummer, Lieferant…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                >
                  <option value="">Alle Belegarten</option>
                  {docTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              {availableYears.length > 0 && (
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="pl-9 pr-8 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                  >
                    <option value="">Alle Jahre</option>
                    {availableYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Archive className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground text-sm mb-1">Noch keine Belege archiviert.</p>
                <p className="text-xs text-muted-foreground">Lade deine erste Rechnung, Quittung oder deinen ersten Kontoauszug hoch.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => {
                  const vr = verifyResults[entry.id];
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm text-foreground truncate">{entry.title}</span>
                            <span
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0",
                                TYPE_COLORS[entry.document_type] ?? TYPE_COLORS.other
                              )}
                            >
                              {entry.document_type_label}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            {entry.document_number && (
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {entry.document_number}
                              </span>
                            )}
                            {entry.document_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {fmtDate(entry.document_date)}
                              </span>
                            )}
                            {entry.counterparty && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {entry.counterparty}
                              </span>
                            )}
                            {entry.amount_cents != null && (
                              <span className="font-medium text-foreground">
                                {fmtEuro(entry.amount_cents)}
                              </span>
                            )}
                          </div>

                          {/* Hash + archive date */}
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground/70">
                            <span className="font-mono truncate max-w-[200px]" title={entry.sha256_hash}>
                              SHA-256: {entry.sha256_hash.substring(0, 16)}…
                            </span>
                            <span>Archiviert: {fmtDateTime(entry.archived_at)}</span>
                            <span>Aufbewahren bis: {fmtDate(entry.retention_until)}</span>
                            <span>{fmtBytes(entry.file_size_bytes)}</span>
                          </div>

                          {/* Verify result */}
                          {vr && (
                            <div className={cn(
                              "mt-2 flex items-center gap-1.5 text-xs",
                              vr.valid ? "text-green-400" : "text-red-400"
                            )}>
                              {vr.valid
                                ? <CheckCircle2 className="w-3.5 h-3.5" />
                                : <ShieldAlert className="w-3.5 h-3.5" />
                              }
                              {vr.reason}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => verifyEntry(entry.id)}
                            title="Integrität prüfen"
                            className={cn(
                              "p-2 rounded-lg border transition-colors text-xs",
                              vr?.valid === true
                                ? "border-green-500/40 text-green-400 bg-green-500/10"
                                : vr?.valid === false
                                ? "border-red-500/40 text-red-400 bg-red-500/10"
                                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                          <a
                            href={archiveApi.downloadUrl(entry.id)}
                            download={entry.original_filename || undefined}
                            className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title="Herunterladen"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* GoBD note */}
            {entries.length > 0 && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/15 rounded-xl">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">GoBD-konformes Archiv</strong> — Alle Belege werden mit SHA-256 gehasht und unveränderlich gespeichert (is_locked=true). Archivierte Einträge können nicht verändert oder gelöscht werden. Aufbewahrungsfrist: 10 Jahre gem. § 147 Abs. 3 AO. Zur Integritätsprüfung den <ShieldCheck className="w-3 h-3 inline" />-Button klicken.
                  </span>
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
    </MobileNavProvider>
  );
}
