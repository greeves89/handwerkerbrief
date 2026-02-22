"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Timer, Edit, Trash2, X, CheckSquare, Square, FileText } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from '@/hooks/use-toast'

interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  company_name?: string;
}

interface TimeEntry {
  id: number;
  description: string;
  date: string;
  duration_minutes: number;
  hourly_rate: number;
  total_amount: number;
  billed: boolean;
  customer_id?: number;
  customer?: Customer;
  document_id?: number;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}

function getCustomerName(c?: Customer): string {
  if (!c) return "-";
  if (c.company_name) return c.company_name;
  return `${c.first_name} ${c.last_name}`;
}

export default function TimeEntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isBilling, setIsBilling] = useState(false);
  const [filterBilled, setFilterBilled] = useState<"all" | "unbilled" | "billed">("all");

  const [form, setForm] = useState({
    description: "",
    date: new Date().toISOString().split("T")[0],
    hours: "1",
    minutes: "0",
    hourly_rate: "",
    customer_id: "",
  });

  useEffect(() => {
    Promise.all([
      api.get("/time-entries"),
      api.get("/customers"),
    ]).then(([entriesRes, customersRes]) => {
      setEntries(entriesRes.data);
      setCustomers(customersRes.data);
      setIsLoading(false);
    });
  }, []);

  const openCreate = () => {
    setEditingEntry(undefined);
    setForm({
      description: "",
      date: new Date().toISOString().split("T")[0],
      hours: "1",
      minutes: "0",
      hourly_rate: "",
      customer_id: "",
    });
    setShowForm(true);
  };

  const openEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    const h = Math.floor(entry.duration_minutes / 60);
    const m = entry.duration_minutes % 60;
    setForm({
      description: entry.description,
      date: entry.date,
      hours: String(h),
      minutes: String(m),
      hourly_rate: String(entry.hourly_rate),
      customer_id: entry.customer_id ? String(entry.customer_id) : "",
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const duration_minutes = (parseInt(form.hours) || 0) * 60 + (parseInt(form.minutes) || 0);
    const data = {
      description: form.description,
      date: form.date,
      duration_minutes,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      customer_id: form.customer_id ? parseInt(form.customer_id) : null,
    };
    if (editingEntry) {
      const res = await api.put(`/time-entries/${editingEntry.id}`, data);
      setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? res.data : e)));
    } else {
      const res = await api.post("/time-entries", data);
      setEntries((prev) => [res.data, ...prev]);
    }
    setShowForm(false);
    setIsSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Zeiteintrag loeschen?")) {
      await api.delete(`/time-entries/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleBill = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} Eintraege in Rechnung umwandeln?`)) return;
    setIsBilling(true);
    try {
      const res = await api.post("/time-entries/bill", { entry_ids: Array.from(selectedIds) });
      // Refresh entries
      const updated = await api.get("/time-entries");
      setEntries(updated.data);
      setSelectedIds(new Set());
      window.location.href = `/invoices/${res.data.id}`;
    } catch {
      toast("Fehler beim Erstellen der Rechnung.", 'error')
      setIsBilling(false);
    }
  };

  const filtered = entries.filter((e) => {
    if (filterBilled === "unbilled") return !e.billed;
    if (filterBilled === "billed") return e.billed;
    return true;
  });

  const unbilledSelected = Array.from(selectedIds).filter(
    (id) => entries.find((e) => e.id === id && !e.billed)
  ).length;

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title="Zeiterfassung"
            subtitle="Arbeitszeiten erfassen und direkt in Rechnungen umwandeln"
            actions={
              <div className="flex gap-2">
                {unbilledSelected > 0 && (
                  <button
                    onClick={handleBill}
                    disabled={isBilling}
                    className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    {isBilling ? "Erstelle Rechnung..." : `${unbilledSelected} → Rechnung`}
                  </button>
                )}
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" />
                  Neuer Eintrag
                </button>
              </div>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
              {(["all", "unbilled", "billed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterBilled(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterBilled === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {f === "all" ? "Alle" : f === "unbilled" ? "Nicht abgerechnet" : "Abgerechnet"}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Timer className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-medium mb-1">Keine Eintraege vorhanden</p>
                <p className="text-sm text-muted-foreground mb-4">Erfassen Sie Ihre Arbeitszeiten und rechnen Sie sie direkt ab</p>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  Neuer Eintrag
                </button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="w-10 px-4 py-3"></th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Datum</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Beschreibung</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Dauer</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Stundensatz</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Betrag</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Status</th>
                      <th className="w-20 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry, index) => (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {!entry.billed && (
                            <button onClick={() => toggleSelect(entry.id)} className="text-muted-foreground hover:text-primary">
                              {selectedIds.has(entry.id)
                                ? <CheckSquare className="w-4 h-4 text-primary" />
                                : <Square className="w-4 h-4" />
                              }
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{entry.description}</td>
                        <td className="px-4 py-3 text-muted-foreground">{getCustomerName(entry.customer)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatDuration(entry.duration_minutes)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(Number(entry.hourly_rate))}/Std.</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(Number(entry.total_amount))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            entry.billed
                              ? "bg-success/10 text-success"
                              : "bg-warning/10 text-warning"
                          }`}>
                            {entry.billed ? "Abgerechnet" : "Offen"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!entry.billed && (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => openEdit(entry)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(entry.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingEntry ? "Zeiteintrag bearbeiten" : "Neuer Zeiteintrag"}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Beschreibung *</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  placeholder="z.B. Installationsarbeiten Keller"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Datum *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Stundensatz (EUR)</label>
                  <input
                    type="number"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Stunden</label>
                  <input
                    type="number"
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                    min="0"
                    max="24"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Minuten</label>
                  <select
                    value={form.minutes}
                    onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={String(m)}>{m} Min.</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Kunde</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Kein Kunde</option>
                  {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.company_name || `${c.first_name} ${c.last_name}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent">
                  Abbrechen
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {isSaving ? "Speichern..." : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
