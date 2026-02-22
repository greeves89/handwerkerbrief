"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Download,
  Calculator,
  Building2,
  Calendar,
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UStVASummary {
  year: number;
  period: string;
  period_label: string;
  invoices_count: number;
  total_netto_19: number;
  total_steuer_19: number;
  total_netto_7: number;
  total_steuer_7: number;
  total_netto_0: number;
  total_revenue_gross: number;
}

interface Period {
  value: string;
  label: string;
  type: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEuro(cents: number | null | undefined): string {
  if (cents == null) return "0,00 €";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function currentYear() {
  return new Date().getFullYear();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const [year, setYear] = useState(currentYear());
  const [period, setPeriod] = useState("01");
  const [periodType, setPeriodType] = useState<"monthly" | "quarterly">("monthly");
  const [periods, setPeriods] = useState<{ months: Period[]; quarters: Period[] }>({ months: [], quarters: [] });
  const [summary, setSummary] = useState<UStVASummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Finanzamt data
  const [steuernummer, setSteuernummer] = useState("");
  const [finanzamtNr, setFinanzamtNr] = useState("");
  const [name, setName] = useState("");
  const [strasse, setStrasse] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");

  // Manual overrides
  const [manualVorsteuer, setManualVorsteuer] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState("");

  // Load periods
  useEffect(() => {
    api.get("/tax/periods").then((r) => setPeriods(r.data)).catch(() => {});
  }, []);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setSummary(null);
    try {
      const res = await api.get("/tax/ustv/summary", { params: { year, period } });
      setSummary(res.data);
    } catch {
      // ignore
    } finally {
      setLoadingSummary(false);
    }
  }, [year, period]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const availablePeriods = periodType === "monthly" ? periods.months : periods.quarters;

  async function handleExport() {
    if (!steuernummer.trim()) { setError("Bitte Steuernummer eingeben."); return; }
    if (!finanzamtNr.trim() || finanzamtNr.length !== 4) { setError("Finanzamtnummer muss 4-stellig sein."); return; }
    if (!name.trim()) { setError("Bitte Name / Firmenname eingeben."); return; }
    setError("");
    setExporting(true);
    try {
      const vorsteuerCents = manualVorsteuer
        ? Math.round(parseFloat(manualVorsteuer.replace(",", ".")) * 100)
        : undefined;

      const res = await api.post("/tax/ustv/export-xml", {
        year, period,
        steuernummer: steuernummer.trim(),
        finanzamt_nr: finanzamtNr.trim(),
        name: name.trim(),
        strasse: strasse.trim() || undefined,
        plz: plz.trim() || undefined,
        ort: ort.trim() || undefined,
        kz66_vorsteuer: vorsteuerCents,
      }, { responseType: "blob" });

      const url = URL.createObjectURL(new Blob([res.data], { type: "application/xml" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `UStVA_${year}_${period}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 4000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Export fehlgeschlagen.");
    } finally {
      setExporting(false);
    }
  }

  const zahllast = summary
    ? summary.total_steuer_19 + summary.total_steuer_7 - (manualVorsteuer ? Math.round(parseFloat(manualVorsteuer.replace(",", ".")) * 100) : 0)
    : 0;

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Umsatzsteuervoranmeldung"
            subtitle="UStVA – ELSTER XML-Export für das Finanzportal"
          />

          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Info banner */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                  <strong className="text-blue-200">So funktioniert es:</strong> Wähle Jahr und Zeitraum, prüfe die berechneten Umsätze aus deinen Rechnungen, gib deine Steuerdaten ein und lade das fertige ELSTER-XML herunter. Dieses XML kannst du anschließend unter{" "}
                  <a href="https://www.elster.de/eportal" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-100 inline-flex items-center gap-0.5">
                    elster.de/eportal <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  hochladen und ans Finanzamt übertragen.
                </div>
              </div>

              {/* Period selector */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Voranmeldezeitraum
                </h2>

                <div className="flex flex-wrap gap-4 items-end">
                  {/* Year */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Jahr</label>
                    <div className="relative">
                      <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="px-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                      >
                        {[currentYear(), currentYear() - 1, currentYear() - 2].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* Period type toggle */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Typ</label>
                    <div className="flex gap-1 bg-background border border-border rounded-lg p-1">
                      {(["monthly", "quarterly"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setPeriodType(t);
                            setPeriod(t === "monthly" ? "01" : "41");
                          }}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                            periodType === t
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {t === "monthly" ? "Monat" : "Quartal"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Period selector */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {periodType === "monthly" ? "Monat" : "Quartal"}
                    </label>
                    <div className="relative">
                      <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                      >
                        {availablePeriods.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Berechnete Umsätze aus Rechnungen
                </h2>

                {loadingSummary ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : summary ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground mb-4">
                      Basis: {summary.invoices_count} Rechnungen ({summary.period_label} {summary.year})
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-xs text-muted-foreground font-medium">Kennzahl</th>
                            <th className="text-left py-2 text-xs text-muted-foreground font-medium">Beschreibung</th>
                            <th className="text-right py-2 text-xs text-muted-foreground font-medium">Betrag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          <tr>
                            <td className="py-2.5 font-mono text-xs text-muted-foreground">Kz 81</td>
                            <td className="py-2.5">Steuerpflichtige Umsätze 19% (Netto)</td>
                            <td className="py-2.5 text-right font-medium">{fmtEuro(summary.total_netto_19)}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 font-mono text-xs text-muted-foreground">Kz 83</td>
                            <td className="py-2.5">Steuer darauf (19%)</td>
                            <td className="py-2.5 text-right font-medium text-primary">{fmtEuro(summary.total_steuer_19)}</td>
                          </tr>
                          {summary.total_netto_7 > 0 && (
                            <>
                              <tr>
                                <td className="py-2.5 font-mono text-xs text-muted-foreground">Kz 86</td>
                                <td className="py-2.5">Steuerpflichtige Umsätze 7% (Netto)</td>
                                <td className="py-2.5 text-right font-medium">{fmtEuro(summary.total_netto_7)}</td>
                              </tr>
                              <tr>
                                <td className="py-2.5 font-mono text-xs text-muted-foreground">Kz 36</td>
                                <td className="py-2.5">Steuer darauf (7%)</td>
                                <td className="py-2.5 text-right font-medium text-primary">{fmtEuro(summary.total_steuer_7)}</td>
                              </tr>
                            </>
                          )}
                          <tr className="bg-muted/20">
                            <td className="py-2.5 font-mono text-xs text-muted-foreground">Kz 66</td>
                            <td className="py-2.5">
                              Abziehbare Vorsteuer (manuell eingeben)
                              <input
                                type="text"
                                placeholder="0,00"
                                value={manualVorsteuer}
                                onChange={(e) => setManualVorsteuer(e.target.value)}
                                className="ml-3 w-28 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="ml-1 text-xs text-muted-foreground">€</span>
                            </td>
                            <td className="py-2.5 text-right font-medium text-green-400">
                              {manualVorsteuer
                                ? fmtEuro(Math.round(parseFloat(manualVorsteuer.replace(",", ".")) * 100))
                                : "0,00 €"}
                            </td>
                          </tr>
                          <tr className="border-t-2 border-border">
                            <td className="py-3 font-mono text-xs text-muted-foreground">Kz 69</td>
                            <td className="py-3 font-semibold">Verbleibende Zahllast / Erstattung</td>
                            <td className={cn(
                              "py-3 text-right font-bold text-base",
                              zahllast > 0 ? "text-red-400" : "text-green-400"
                            )}>
                              {zahllast > 0 ? fmtEuro(zahllast) : `−${fmtEuro(-zahllast)}`}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Keine Daten verfügbar.</p>
                )}
              </div>

              {/* Steuer-/Finanzamtsdaten */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Ihre Angaben
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Name / Firmenname *
                    </label>
                    <input
                      type="text"
                      placeholder="Max Mustermann / Handwerk GmbH"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Steuernummer *
                    </label>
                    <input
                      type="text"
                      placeholder="21/815/08150"
                      value={steuernummer}
                      onChange={(e) => setSteuernummer(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Finanzamtnummer (4-stellig) *
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. 2101"
                      maxLength={4}
                      value={finanzamtNr}
                      onChange={(e) => setFinanzamtNr(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Zu finden auf Ihrem Steuerbescheid oder unter{" "}
                      <a href="https://www.bzst.de/DE/Service/Behoerdenwegweiser/Finanzamtsuche/GemFa/finanzamtsuche_node.html"
                        target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline">
                        bzst.de
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Straße</label>
                    <input
                      type="text"
                      placeholder="Musterstraße 1"
                      value={strasse}
                      onChange={(e) => setStrasse(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">PLZ</label>
                    <input
                      type="text"
                      placeholder="12345"
                      value={plz}
                      onChange={(e) => setPlz(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Ort</label>
                    <input
                      type="text"
                      placeholder="Musterstadt"
                      value={ort}
                      onChange={(e) => setOrt(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Export button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleExport}
                  disabled={exporting || !summary}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? "Exportiere…" : "ELSTER-XML herunterladen"}
                </button>

                <AnimatePresence>
                  {exported && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-green-400 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      XML heruntergeladen! Jetzt bei elster.de hochladen.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Steps after export */}
              {exported && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl"
                >
                  <p className="text-sm font-medium text-green-300 mb-2">Nächste Schritte:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-green-200/80">
                    <li>Melde dich unter <a href="https://www.elster.de/eportal" target="_blank" rel="noopener noreferrer" className="underline">elster.de/eportal</a> an</li>
                    <li>Gehe zu „Formulare & Leistungen" → „Umsatzsteuervoranmeldung"</li>
                    <li>Wähle „XML-Upload" und lade die heruntergeladene Datei hoch</li>
                    <li>Prüfe die Daten und sende die Voranmeldung ab</li>
                  </ol>
                </motion.div>
              )}

            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
    </MobileNavProvider>
  );
}
