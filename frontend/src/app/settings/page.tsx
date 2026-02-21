"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Upload, Trash2, Download } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { User } from "@/lib/types";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState<Partial<User>>({});
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "company" | "banking" | "documents" | "account">("profile");

  useEffect(() => {
    if (user) setForm(user);
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const res = await api.put("/users/me", form);
      setUser(res.data);
      setMessage("Einstellungen gespeichert!");
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post("/users/me/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setUser(res.data);
    setMessage("Logo hochgeladen!");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm) {
      setMessage("Passwoerter stimmen nicht ueberein");
      return;
    }
    try {
      await api.put("/users/me/password", passwordForm);
      setMessage("Passwort geaendert!");
      setPasswordForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err: any) {
      setMessage(err.response?.data?.detail || "Fehler beim Aendern");
    }
  };

  const handleExportData = async () => {
    const res = await api.get("/gdpr/export", { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "meine_daten.json";
    a.click();
  };

  const tabs = [
    { id: "profile", label: "Profil" },
    { id: "company", label: "Unternehmen" },
    { id: "banking", label: "Bankdaten" },
    { id: "documents", label: "Dokumente" },
    { id: "account", label: "Konto" },
  ] as const;

  const field = (label: string, key: keyof typeof form, placeholder?: string, type = "text") => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={String(form[key] || "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title="Einstellungen"
            subtitle="Verwalten Sie Ihr Profil und Ihre Praeferenzen"
            actions={
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Speichern..." : "Speichern"}
              </button>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-4 py-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success"
              >
                {message}
              </motion.div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Persoenliche Daten</h3>
                  {field("Name", "name", "Max Mustermann")}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">E-Mail</label>
                    <input value={user?.email || ""} disabled className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm text-muted-foreground cursor-not-allowed" />
                  </div>
                  {field("Telefon", "phone", "+49 123 456789")}
                </div>
              )}

              {activeTab === "company" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Unternehmensdetails</h3>
                  {/* Logo upload */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Firmenlogo</label>
                    <div className="flex items-center gap-3">
                      {user?.logo_path && (
                        <img
                          src={`/uploads/${user.logo_path}`}
                          alt="Logo"
                          className="w-16 h-16 object-contain rounded-lg border border-border"
                        />
                      )}
                      <label className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Logo hochladen
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                  {field("Firmenname", "company_name", "Muster GmbH")}
                  {field("Strasse", "address_street", "Musterstrasse 1")}
                  <div className="grid grid-cols-3 gap-4">
                    {field("PLZ", "address_zip", "12345")}
                    {field("Stadt", "address_city", "Berlin")}
                    {field("Land", "address_country", "Deutschland")}
                  </div>
                  {field("Steuernummer", "tax_number", "123/456/78901")}
                  {field("USt-IdNr.", "ustid", "DE123456789")}
                </div>
              )}

              {activeTab === "banking" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Bankverbindung</h3>
                  {field("IBAN", "iban", "DE00 1234 5678 9012 3456 78")}
                  {field("BIC", "bic", "DEUTDEDB")}
                  {field("Bank", "bank_name", "Deutsche Bank")}
                </div>
              )}

              {activeTab === "documents" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Dokument-Einstellungen</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {field("Rechnungs-Praefix", "invoice_prefix", "RE-")}
                    {field("Angebots-Praefix", "offer_prefix", "AN-")}
                  </div>
                  <div className="p-4 bg-secondary/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Der naechste Rechnungszaehler: <strong>{user?.invoice_counter}</strong><br />
                      Der naechste Angebotszaehler: <strong>{user?.offer_counter}</strong>
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "account" && (
                <div className="space-y-6">
                  {/* Subscription info */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-4">Abonnement</h3>
                    <div className="p-4 bg-secondary/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {user?.subscription_tier === "premium" ? "Premium" : "Kostenlos"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user?.subscription_tier === "free"
                              ? "3 Rechnungen + 3 Angebote pro Monat"
                              : "Unbegrenzte Rechnungen und Angebote"}
                          </p>
                        </div>
                        {user?.subscription_tier === "free" && (
                          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                            Auf Premium upgraden
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Change password */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-4">Passwort aendern</h3>
                    <form onSubmit={handlePasswordChange} className="space-y-3">
                      <input
                        type="password"
                        value={passwordForm.current_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                        placeholder="Aktuelles Passwort"
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                        placeholder="Neues Passwort (min. 8 Zeichen)"
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="password"
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                        placeholder="Neues Passwort bestaetigen"
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                        Passwort aendern
                      </button>
                    </form>
                  </div>

                  {/* DSGVO */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-4">Datenschutz (DSGVO)</h3>
                    <div className="space-y-3">
                      <button
                        onClick={handleExportData}
                        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent"
                      >
                        <Download className="w-4 h-4" />
                        Meine Daten exportieren
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Konto WIRKLICH loeschen? Diese Aktion ist unwiderruflich!")) {
                            await api.delete("/gdpr/delete-account");
                            window.location.href = "/login";
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-destructive/30 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Konto loeschen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
