"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Info,
  Building2,
  Hash,
  Calendar,
  Euro,
  CreditCard,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ocrApi } from "@/lib/api";

interface OcrResult {
  text_found: boolean;
  file_path: string;
  original_filename: string | null;
  hint: string | null;
  extracted: {
    lieferant?: string;
    rechnungsnummer?: string;
    datum?: string;
    brutto?: number;
    netto?: number;
    mwst?: number;
    iban?: string;
  };
}

function fmtEuro(val: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val);
}

export default function OcrPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError("");
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError("");
    }
  }

  async function scan() {
    if (!file) return;
    setScanning(true);
    setError("");
    setResult(null);
    try {
      const res = await ocrApi.scan(file);
      setResult(res.data as OcrResult);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Fehler beim Scannen des Dokuments.");
    } finally {
      setScanning(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const extracted = result?.extracted ?? {};
  const hasFields = Object.keys(extracted).length > 0;

  const fields: { label: string; value: string | undefined; icon: React.ElementType }[] = [
    { label: "Lieferant / Absender", value: extracted.lieferant, icon: Building2 },
    { label: "Rechnungsnummer", value: extracted.rechnungsnummer, icon: Hash },
    { label: "Datum", value: extracted.datum, icon: Calendar },
    { label: "Bruttobetrag", value: extracted.brutto != null ? fmtEuro(extracted.brutto) : undefined, icon: Euro },
    { label: "Nettobetrag", value: extracted.netto != null ? fmtEuro(extracted.netto) : undefined, icon: Euro },
    { label: "MwSt-Betrag", value: extracted.mwst != null ? fmtEuro(extracted.mwst) : undefined, icon: Euro },
    { label: "IBAN", value: extracted.iban, icon: CreditCard },
  ].filter((f) => f.value !== undefined);

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Belegscanner"
            subtitle="Eingangsrechnung hochladen – Felder werden automatisch erkannt"
          />

          <main className="flex-1 overflow-y-auto p-6 max-w-3xl">

            {/* Upload area */}
            {!result && (
              <div
                className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors mb-6"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <ScanLine className="w-10 h-10 text-muted-foreground mb-3" />
                {file ? (
                  <>
                    <p className="font-medium text-foreground text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground text-sm">PDF oder Bild hierher ziehen</p>
                    <p className="text-xs text-muted-foreground mt-1">oder klicken zum Auswählen</p>
                    <p className="text-xs text-muted-foreground/60 mt-2">Unterstützt: PDF, JPEG, PNG, TIFF · Max. 20 MB</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scan button */}
            {file && !result && (
              <button
                onClick={scan}
                disabled={scanning}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 mb-6"
              >
                {scanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Wird gescannt…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Jetzt scannen
                  </>
                )}
              </button>
            )}

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Status banner */}
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                    result.text_found
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-amber-500/10 border-amber-500/30"
                  }`}>
                    {result.text_found
                      ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                      : <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className={`font-medium text-sm ${result.text_found ? "text-green-400" : "text-amber-400"}`}>
                        {result.text_found ? "Felder automatisch erkannt" : "Keine automatische Erkennung möglich"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {result.hint ?? `Aus "${result.original_filename}" wurden die folgenden Felder extrahiert.`}
                      </p>
                    </div>
                  </div>

                  {/* Extracted fields */}
                  {hasFields && (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm text-foreground">Erkannte Felder</span>
                      </div>
                      <div className="divide-y divide-border">
                        {fields.map(({ label, value, icon: Icon }) => (
                          <div key={label} className="flex items-center gap-3 px-4 py-3">
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
                            <span className="text-sm text-foreground font-medium break-all">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasFields && result.text_found && (
                    <div className="p-4 bg-muted rounded-xl text-sm text-muted-foreground">
                      Text wurde erkannt, aber keine strukturierten Felder (Betrag, Datum etc.) konnten extrahiert werden. Bitte Felder manuell eingeben.
                    </div>
                  )}

                  {/* Info note */}
                  <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl">
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      Die erkannten Felder können als Vorlage beim manuellen Erfassen einer Eingangsrechnung verwendet werden. Für eine rechtssichere Archivierung nutze das <strong className="text-foreground">GoBD-Belegarchiv</strong>.
                    </p>
                  </div>

                  {/* Reset */}
                  <button
                    onClick={reset}
                    className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Neues Dokument scannen
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </main>
        </div>
      </div>
    </AuthGuard>
    </MobileNavProvider>
  );
}
