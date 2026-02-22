"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Save, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface EmailTemplate {
  id: number;
  type: string;
  name: string;
  subject: string;
  body_html: string;
}

const PLACEHOLDERS = [
  { key: "{{customer_name}}", desc: "Name des Kunden" },
  { key: "{{invoice_number}}", desc: "Rechnungsnummer" },
  { key: "{{amount}}", desc: "Offener Betrag in €" },
  { key: "{{due_date}}", desc: "Fälligkeitsdatum" },
  { key: "{{company_name}}", desc: "Ihr Firmenname" },
];

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const load = async () => {
    const res = await api.get("/admin/email-templates");
    setTemplates(res.data);
    if (res.data.length > 0 && !selected) {
      selectTemplate(res.data[0]);
    }
  };

  useEffect(() => { load(); }, []);

  const selectTemplate = (tmpl: EmailTemplate) => {
    setSelected(tmpl);
    setEditSubject(tmpl.subject);
    setEditBody(tmpl.body_html);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const res = await api.put(`/admin/email-templates/${selected.type}`, {
        subject: editSubject,
        body_html: editBody,
      });
      setTemplates((prev) => prev.map((t) => t.type === selected.type ? res.data : t));
      setSelected(res.data);
      setSuccessMsg("Template gespeichert!");
    } catch {
      setErrorMsg("Fehler beim Speichern.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selected || !confirm("Template auf Standard zurücksetzen?")) return;
    setIsResetting(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const res = await api.post(`/admin/email-templates/${selected.type}/reset`);
      setTemplates((prev) => prev.map((t) => t.type === selected.type ? res.data : t));
      setSelected(res.data);
      setEditSubject(res.data.subject);
      setEditBody(res.data.body_html);
      setSuccessMsg("Template zurückgesetzt.");
    } catch {
      setErrorMsg("Fehler beim Zurücksetzen.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <MobileNavProvider>
    <AuthGuard adminOnly>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="E-Mail Templates" subtitle="Zahlungserinnerungs-Vorlagen anpassen" />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-[280px_1fr] gap-6 h-full">

              {/* Template selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">
                  Mahnstufen
                </p>
                {templates.map((tmpl) => (
                  <motion.button
                    key={tmpl.type}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectTemplate(tmpl)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl border transition-all",
                      selected?.type === tmpl.type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:border-primary/40 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{tmpl.name}</span>
                    </div>
                  </motion.button>
                ))}

                {/* Placeholder reference */}
                <div className="mt-6 bg-muted/50 rounded-xl p-4 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Verfügbare Platzhalter
                  </p>
                  <div className="space-y-2">
                    {PLACEHOLDERS.map((ph) => (
                      <div key={ph.key}>
                        <code className="text-xs bg-background px-1.5 py-0.5 rounded border border-border text-primary font-mono">
                          {ph.key}
                        </code>
                        <p className="text-xs text-muted-foreground mt-0.5">{ph.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Editor */}
              {selected ? (
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">{selected.name}</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={handleReset}
                        disabled={isResetting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Zurücksetzen
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? "Speichern..." : "Speichern"}
                      </button>
                    </div>
                  </div>

                  {successMsg && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-700 dark:text-green-400 text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {successMsg}
                    </div>
                  )}
                  {errorMsg && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {errorMsg}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Betreff
                    </label>
                    <input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      placeholder="E-Mail Betreff..."
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      E-Mail Text (HTML)
                    </label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={18}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                      placeholder="HTML-Inhalt des E-Mail-Textes..."
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      HTML-Tags und Platzhalter wie <code className="text-primary font-mono">{"{{customer_name}}"}</code> sind erlaubt.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl flex items-center justify-center text-muted-foreground">
                  Kein Template ausgewählt
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
    </MobileNavProvider>
  );
}
