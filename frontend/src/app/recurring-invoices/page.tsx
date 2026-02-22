"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCw, Edit, Trash2, X, Pause, Play } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  company_name?: string;
}

interface RItem {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
}

interface RecurringInvoice {
  id: number;
  customer_id: number;
  title?: string;
  interval: string;
  next_date: string;
  last_created_at?: string;
  active: boolean;
  tax_rate: number;
  discount_percent: number;
  payment_terms?: string;
  notes?: string;
  items: RItem[];
  created_at: string;
}

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "Monatlich",
  quarterly: "Vierteljährlich",
  yearly: "Jährlich",
};

function getCustomerName(c?: Customer): string {
  if (!c) return "-";
  if (c.company_name) return c.company_name;
  return `${c.first_name} ${c.last_name}`;
}

function calcTotal(items: RItem[], tax_rate: number, discount_percent: number): number {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.price_per_unit, 0);
  const afterDiscount = subtotal * (1 - discount_percent / 100);
  return afterDiscount * (1 + tax_rate / 100);
}

const emptyItem = (): RItem => ({ name: "", quantity: 1, unit: "Stück", price_per_unit: 0 });

export default function RecurringInvoicesPage() {
  const [entries, setEntries] = useState<RecurringInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<number, Customer>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoice | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    title: "",
    interval: "monthly",
    next_date: new Date().toISOString().split("T")[0],
    tax_rate: "19",
    discount_percent: "0",
    payment_terms: "",
    notes: "",
    items: [emptyItem()],
  });

  useEffect(() => {
    Promise.all([
      api.get("/recurring-invoices"),
      api.get("/customers"),
    ]).then(([riRes, custRes]) => {
      setEntries(riRes.data);
      setCustomers(custRes.data);
      const map: Record<number, Customer> = {};
      for (const c of custRes.data) map[c.id] = c;
      setCustomersMap(map);
      setIsLoading(false);
    });
  }, []);

  const openCreate = () => {
    setEditing(undefined);
    setForm({
      customer_id: "",
      title: "",
      interval: "monthly",
      next_date: new Date().toISOString().split("T")[0],
      tax_rate: "19",
      discount_percent: "0",
      payment_terms: "",
      notes: "",
      items: [emptyItem()],
    });
    setShowForm(true);
  };

  const openEdit = (ri: RecurringInvoice) => {
    setEditing(ri);
    setForm({
      customer_id: String(ri.customer_id),
      title: ri.title || "",
      interval: ri.interval,
      next_date: ri.next_date,
      tax_rate: String(ri.tax_rate),
      discount_percent: String(ri.discount_percent),
      payment_terms: ri.payment_terms || "",
      notes: ri.notes || "",
      items: ri.items.length > 0 ? ri.items : [emptyItem()],
    });
    setShowForm(true);
  };

  const updateItem = (idx: number, field: keyof RItem, value: string | number) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const removeItem = (idx: number) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const data = {
      customer_id: parseInt(form.customer_id),
      title: form.title || null,
      interval: form.interval,
      next_date: form.next_date,
      tax_rate: parseFloat(form.tax_rate),
      discount_percent: parseFloat(form.discount_percent),
      payment_terms: form.payment_terms || null,
      notes: form.notes || null,
      items: form.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        price_per_unit: Number(i.price_per_unit),
      })),
    };
    if (editing) {
      const res = await api.put(`/recurring-invoices/${editing.id}`, data);
      setEntries((prev) => prev.map((r) => (r.id === editing.id ? res.data : r)));
    } else {
      const res = await api.post("/recurring-invoices", data);
      setEntries((prev) => [res.data, ...prev]);
    }
    setShowForm(false);
    setIsSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Wiederholungsrechnung löschen?")) {
      await api.delete(`/recurring-invoices/${id}`);
      setEntries((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleToggleActive = async (ri: RecurringInvoice) => {
    const res = await api.put(`/recurring-invoices/${ri.id}`, { active: !ri.active });
    setEntries((prev) => prev.map((r) => (r.id === ri.id ? res.data : r)));
  };

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Wiederholungsrechnungen"
            subtitle="Rechnungen automatisch in konfigurierbaren Intervallen erstellen"
            actions={
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Neue Vorlage
              </button>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <RefreshCw className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-medium mb-1">Keine Vorlagen vorhanden</p>
                <p className="text-sm text-muted-foreground mb-4">Erstellen Sie Vorlagen für automatisch wiederkehrende Rechnungen</p>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  Neue Vorlage
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {entries.map((ri, index) => (
                  <motion.div
                    key={ri.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-card border rounded-xl p-5 ${ri.active ? "border-border" : "border-border/50 opacity-60"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ri.active ? "bg-primary/10" : "bg-muted"}`}>
                          <RefreshCw className={`w-5 h-5 ${ri.active ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {ri.title || `Rechnung für ${getCustomerName(customersMap[ri.customer_id])}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getCustomerName(customersMap[ri.customer_id])} &middot; {INTERVAL_LABELS[ri.interval] || ri.interval}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${ri.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {ri.active ? "Aktiv" : "Pausiert"}
                        </span>
                        <button onClick={() => handleToggleActive(ri)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent" title={ri.active ? "Pausieren" : "Aktivieren"}>
                          {ri.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openEdit(ri)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(ri.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-6 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Nächste Erstellung</p>
                        <p className="font-medium text-foreground">{formatDate(ri.next_date)}</p>
                      </div>
                      {ri.last_created_at && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Zuletzt erstellt</p>
                          <p className="font-medium text-foreground">{formatDate(ri.last_created_at)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Betrag (ca.)</p>
                        <p className="font-medium text-foreground">{formatCurrency(calcTotal(ri.items, Number(ri.tax_rate), Number(ri.discount_percent)))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Positionen</p>
                        <p className="font-medium text-foreground">{ri.items.length}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editing ? "Vorlage bearbeiten" : "Neue Wiederholungsrechnung"}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Kunde *</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Kunde wählen...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.company_name || `${c.first_name} ${c.last_name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intervall</label>
                  <select
                    value={form.interval}
                    onChange={(e) => setForm({ ...form, interval: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Vierteljährlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Titel (optional)</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="z.B. Wartungsvertrag"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Erste Erstellung am *</label>
                  <input
                    type="date"
                    value={form.next_date}
                    onChange={(e) => setForm({ ...form, next_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">MwSt. (%)</label>
                  <input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} min="0" max="100" step="1" className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rabatt (%)</label>
                  <input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} min="0" max="100" step="0.1" className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Positionen</label>
                  <button type="button" onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Position hinzufügen
                  </button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          value={item.name}
                          onChange={(e) => updateItem(idx, "name", e.target.value)}
                          placeholder="Bezeichnung"
                          required
                          className="w-full px-2 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 1)}
                          min="0.001"
                          step="0.001"
                          placeholder="Menge"
                          className="w-full px-2 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          placeholder="Einheit"
                          className="w-full px-2 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.price_per_unit}
                          onChange={(e) => updateItem(idx, "price_per_unit", parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          placeholder="Preis"
                          className="w-full px-2 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
    </MobileNavProvider>
  );
}
