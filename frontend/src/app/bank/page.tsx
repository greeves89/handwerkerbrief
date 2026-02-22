"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Info,
  Link2,
  Link2Off,
  EyeOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Filter,
  X,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { bankApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Transaction {
  id: number;
  booking_date: string;
  counterparty: string | null;
  purpose: string | null;
  amount: number;
  currency: string;
  matched_document_id: number | null;
  matched_document_number: string | null;
  match_confidence: number;
  is_manually_matched: boolean;
  is_ignored: boolean;
}

interface OpenInvoice {
  id: number;
  document_number: string;
  customer_name: string;
  total_amount: number;
  issue_date: string;
  status: string;
}

interface Stats {
  total: number;
  matched: number;
  unmatched: number;
  ignored: number;
  total_income: number;
  total_expense: number;
}

interface ImportResult {
  imported: number;
  skipped_duplicates: number;
  auto_matched: number;
  batch_id: string;
}

function fmtEuro(val: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val);
}

function confidenceBadge(c: number, manual: boolean) {
  if (manual) return { label: "Manuell", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
  if (c >= 90) return { label: "Sicher", cls: "bg-green-500/20 text-green-400 border-green-500/30" };
  if (c >= 70) return { label: "Wahrscheinlich", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
  return { label: "Möglich", cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
}

// ── Match Modal ───────────────────────────────────────────────────────────────

function MatchModal({
  txn,
  onClose,
  onDone,
}: {
  txn: Transaction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(txn.matched_document_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    bankApi.openInvoices().then((r) => {
      setInvoices(r.data as OpenInvoice[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await bankApi.match(txn.id, selected);
      onDone();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Fehler beim Speichern.");
    } finally {
      setSaving(false);
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
        className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Rechnung zuordnen
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{txn.counterparty || "—"}</p>
          <p className="mt-0.5 truncate">{txn.purpose || "Kein Verwendungszweck"}</p>
          <p className="mt-1 font-medium text-foreground">{fmtEuro(txn.amount)}</p>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-colors text-sm",
              selected === null
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-accent"
            )}
          >
            <span className="text-muted-foreground italic">Keine Zuordnung (Zuweisung entfernen)</span>
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine offenen Rechnungen.</p>
          ) : (
            invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => setSelected(inv.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  selected === inv.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{inv.document_number}</span>
                  <span className="text-sm font-medium text-foreground">{fmtEuro(inv.total_amount)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{inv.customer_name} · {inv.issue_date}</p>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors">
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Speichert…" : "Zuordnung speichern"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BankPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [matchTxn, setMatchTxn] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txnRes, statsRes] = await Promise.all([
        bankApi.list({ unmatched_only: unmatchedOnly, limit: 200 }),
        bankApi.stats(),
      ]);
      setTxns(txnRes.data as Transaction[]);
      setStats(statsRes.data as Stats);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [unmatchedOnly]);

  useEffect(() => { load(); }, [load]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    try {
      const res = await bankApi.import(file);
      setImportResult(res.data as ImportResult);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setImportError(msg || "Fehler beim Import. Bitte CSV-Format prüfen.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleIgnore(txnId: number) {
    await bankApi.ignore(txnId);
    await load();
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />

        <AnimatePresence>
          {matchTxn && (
            <MatchModal
              txn={matchTxn}
              onClose={() => setMatchTxn(null)}
              onDone={() => { setMatchTxn(null); load(); }}
            />
          )}
        </AnimatePresence>

        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title="Bankabgleich"
            subtitle="Kontoauszug importieren & Zahlungseingänge automatisch Rechnungen zuordnen"
            actions={
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {importing ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {importing ? "Importiert…" : "CSV importieren"}
              </button>
            }
          />
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />

          <main className="flex-1 overflow-y-auto p-6">

            {/* Import result banner */}
            <AnimatePresence>
              {importResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-400 text-sm">Import erfolgreich</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {importResult.imported} Buchungen importiert · {importResult.auto_matched} automatisch zugeordnet · {importResult.skipped_duplicates} Duplikate übersprungen
                    </p>
                  </div>
                  <button onClick={() => setImportResult(null)} className="ml-auto p-1 hover:bg-green-500/20 rounded">
                    <X className="w-3.5 h-3.5 text-green-400" />
                  </button>
                </motion.div>
              )}
              {importError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <p className="text-sm text-red-400 flex-1">{importError}</p>
                  <button onClick={() => setImportError("")} className="p-1 hover:bg-red-500/20 rounded">
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Buchungen gesamt", value: stats.total, icon: Landmark },
                  { label: "Zugeordnet", value: stats.matched, icon: CheckCircle2 },
                  { label: "Offen", value: stats.unmatched, icon: AlertTriangle },
                  { label: "Einnahmen gesamt", value: fmtEuro(stats.total_income), icon: TrendingUp },
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

            {/* Filter */}
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => setUnmatchedOnly(!unmatchedOnly)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                  unmatchedOnly
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                Nur offene Einnahmen
              </button>
              <button onClick={load} className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-accent transition-colors" title="Aktualisieren">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Info box for empty state */}
            {!loading && txns.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Landmark className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <p className="font-medium text-foreground mb-1">Noch keine Buchungen importiert</p>
                <p className="text-sm text-muted-foreground mb-4">Exportiere deinen Kontoauszug als CSV aus deinem Online-Banking und importiere ihn hier.</p>
                <div className="p-4 bg-muted rounded-xl text-xs text-muted-foreground text-left max-w-sm">
                  <p className="font-medium text-foreground mb-2">Unterstützte Formate:</p>
                  <ul className="space-y-1">
                    <li>• DKB Girokonto-Export (CSV)</li>
                    <li>• Sparkasse / VR-Bank (CSV)</li>
                    <li>• Comdirect (CSV)</li>
                    <li>• Die meisten deutschen Banken mit CSV-Export</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Transactions list */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {txns.map((txn) => {
                  const isIncome = txn.amount > 0;
                  const badge = txn.matched_document_id
                    ? confidenceBadge(txn.match_confidence, txn.is_manually_matched)
                    : null;

                  return (
                    <motion.div
                      key={txn.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "bg-card border rounded-xl p-4 transition-colors",
                        txn.is_ignored ? "opacity-50 border-border" : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {/* Amount indicator */}
                        <div className={cn(
                          "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                          isIncome ? "bg-green-500/10" : "bg-red-500/10"
                        )}>
                          {isIncome
                            ? <TrendingUp className="w-4 h-4 text-green-400" />
                            : <TrendingDown className="w-4 h-4 text-red-400" />
                          }
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={cn(
                              "text-base font-semibold",
                              isIncome ? "text-green-400" : "text-red-400"
                            )}>
                              {isIncome ? "+" : ""}{fmtEuro(txn.amount)}
                            </span>
                            <span className="text-xs text-muted-foreground">{txn.booking_date}</span>
                            {badge && (
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", badge.cls)}>
                                {badge.label}
                              </span>
                            )}
                            {txn.is_ignored && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                                Ignoriert
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground font-medium truncate">{txn.counterparty || "—"}</p>
                          {txn.purpose && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{txn.purpose}</p>
                          )}
                          {txn.matched_document_number && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-primary">
                              <FileText className="w-3 h-3" />
                              Rechnung {txn.matched_document_number}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isIncome && !txn.is_ignored && (
                            <button
                              onClick={() => setMatchTxn(txn)}
                              title={txn.matched_document_id ? "Zuordnung ändern" : "Rechnung zuordnen"}
                              className={cn(
                                "p-2 rounded-lg border text-xs transition-colors",
                                txn.matched_document_id
                                  ? "border-primary/40 text-primary bg-primary/10 hover:bg-primary/20"
                                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                            >
                              <Link2 className="w-4 h-4" />
                            </button>
                          )}
                          {txn.matched_document_id && !txn.is_ignored && (
                            <button
                              onClick={() => bankApi.match(txn.id, null).then(load)}
                              title="Zuordnung entfernen"
                              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <Link2Off className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleIgnore(txn.id)}
                            title={txn.is_ignored ? "Ignorierung aufheben" : "Ignorieren"}
                            className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* CSV format hint */}
            {txns.length > 0 && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/15 rounded-xl">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Automatischer Abgleich:</strong> Bei Confidence ≥75% wird die Rechnung automatisch als bezahlt markiert. Buchungen mit exakter Rechnungsnummer im Verwendungszweck erhalten 95% Confidence.
                  </span>
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
