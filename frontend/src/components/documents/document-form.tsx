"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Document, DocumentItem, Customer, Position } from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";
import api from "@/lib/api";

interface DocumentFormProps {
  document?: Document;
  type: "offer" | "invoice";
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

const emptyItem = (): Omit<DocumentItem, "id" | "document_id"> => ({
  position: 1,
  name: "",
  description: "",
  quantity: 1,
  unit: "Stück",
  price_per_unit: 0,
  total_price: 0,
});

export function DocumentForm({ document, type, onSave, onCancel }: DocumentFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [form, setForm] = useState({
    customer_id: document?.customer_id || 0,
    type,
    title: document?.title || (type === "invoice" ? "Rechnung" : "Angebot"),
    intro_text: document?.intro_text || "",
    closing_text: document?.closing_text || "",
    issue_date: document?.issue_date || new Date().toISOString().split("T")[0],
    due_date: document?.due_date || "",
    valid_until: document?.valid_until || "",
    discount_percent: document?.discount_percent || 0,
    tax_rate: document?.tax_rate || 19,
    payment_terms: document?.payment_terms || "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    notes: document?.notes || "",
  });
  const [items, setItems] = useState<Omit<DocumentItem, "id" | "document_id">[]>(
    document?.items?.length ? document.items : [emptyItem()]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/customers").then((r) => setCustomers(r.data));
    api.get("/positions").then((r) => setPositions(r.data));
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price_per_unit, 0);
  const discountAmount = subtotal * (Number(form.discount_percent) / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = subtotalAfterDiscount * (Number(form.tax_rate) / 100);
  const total = subtotalAfterDiscount + taxAmount;

  const updateItem = (index: number, field: keyof DocumentItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "price_per_unit") {
      updated[index].total_price = Number(updated[index].quantity) * Number(updated[index].price_per_unit);
    }
    setItems(updated);
  };

  const addItem = (position?: Position) => {
    if (position) {
      setItems([...items, {
        position: items.length + 1,
        name: position.name,
        description: position.description || "",
        quantity: 1,
        unit: position.unit,
        price_per_unit: Number(position.price_per_unit),
        total_price: Number(position.price_per_unit),
      }]);
    } else {
      setItems([...items, { ...emptyItem(), position: items.length + 1 }]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id) {
      setError("Bitte Kunde auswählen");
      return;
    }
    if (items.length === 0 || !items[0].name) {
      setError("Bitte mindestens eine Position hinzufügen");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await onSave({
        ...form,
        customer_id: Number(form.customer_id),
        discount_percent: Number(form.discount_percent),
        tax_rate: Number(form.tax_rate),
        items: items.map((item, i) => ({
          ...item,
          position: i + 1,
          quantity: Number(item.quantity),
          price_per_unit: Number(item.price_per_unit),
          total_price: Number(item.quantity) * Number(item.price_per_unit),
        })),
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold text-foreground">
            {document ? "Bearbeiten" : `Neues ${type === "invoice" ? "Rechnung" : "Angebot"}`}
          </h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Kunde *</label>
              <select
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={0}>Kunde wählen...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name} ${c.last_name}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Titel</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Datum *</label>
              <input
                type="date"
                value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {type === "invoice" ? (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Zahlungsziel</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Gültig bis</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Intro text */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Einleitungstext</label>
            <textarea
              value={form.intro_text}
              onChange={(e) => setForm({ ...form, intro_text: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-foreground">Positionen</label>
              <div className="flex gap-2">
                {positions.length > 0 && (
                  <select
                    onChange={(e) => {
                      const pos = positions.find((p) => p.id === Number(e.target.value));
                      if (pos) addItem(pos);
                      (e.target as HTMLSelectElement).value = "";
                    }}
                    className="px-3 py-1.5 bg-background border border-input rounded-lg text-xs text-foreground focus:outline-none"
                    defaultValue=""
                  >
                    <option value="">Leistung hinzufügen...</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {formatCurrency(Number(p.price_per_unit))}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => addItem()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" /> Position
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px_100px_80px_32px] gap-2 px-2">
                {["Bezeichnung", "Menge", "Einheit", "Preis/Einheit", "Gesamt", ""].map((h) => (
                  <span key={h} className="text-xs font-medium text-muted-foreground">{h}</span>
                ))}
              </div>

              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_80px_80px_100px_80px_32px] gap-2 p-2 bg-secondary/30 rounded-lg">
                  <div className="space-y-1">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      placeholder="Bezeichnung"
                      className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      value={item.description || ""}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Beschreibung (optional)"
                      className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    className="px-2 py-1.5 bg-background border border-input rounded-md text-xs text-foreground text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    min="0"
                    step="0.01"
                  />
                  <input
                    value={item.unit}
                    onChange={(e) => updateItem(index, "unit", e.target.value)}
                    className="px-2 py-1.5 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="number"
                    value={item.price_per_unit}
                    onChange={(e) => updateItem(index, "price_per_unit", parseFloat(e.target.value) || 0)}
                    className="px-2 py-1.5 bg-background border border-input rounded-md text-xs text-foreground text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    min="0"
                    step="0.01"
                  />
                  <div className="flex items-center justify-end px-2 text-xs font-medium text-foreground">
                    {formatCurrency(item.quantity * item.price_per_unit)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals and tax */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Schlusstext</label>
                <textarea
                  value={form.closing_text}
                  onChange={(e) => setForm({ ...form, closing_text: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              {type === "invoice" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Zahlungsbedingungen</label>
                  <textarea
                    value={form.payment_terms}
                    onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              )}
            </div>
            <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span className="text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rabatt</span>
                  <input
                    type="number"
                    value={form.discount_percent}
                    onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-background border border-input rounded-md text-xs text-foreground text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    min="0" max="100"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                {discountAmount > 0 && (
                  <span className="text-sm text-destructive">-{formatCurrency(discountAmount)}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">MwSt.</span>
                  <select
                    value={form.tax_rate}
                    onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
                    className="px-2 py-1 bg-background border border-input rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value={19}>19%</option>
                    <option value={7}>7%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
                <span className="text-sm text-foreground">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold text-foreground">Gesamt</span>
                <span className="font-bold text-lg text-foreground">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
