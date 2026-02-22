"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wrench, Edit, Trash2, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import api from "@/lib/api";
import { Position } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | undefined>();
  const [form, setForm] = useState({ name: "", description: "", unit: "Stueck", price_per_unit: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.get("/positions").then((r) => {
      setPositions(r.data);
      setIsLoading(false);
    });
  }, []);

  const openEdit = (pos: Position) => {
    setEditingPosition(pos);
    setForm({
      name: pos.name,
      description: pos.description || "",
      unit: pos.unit,
      price_per_unit: String(pos.price_per_unit),
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingPosition(undefined);
    setForm({ name: "", description: "", unit: "Stueck", price_per_unit: "" });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const data = { ...form, price_per_unit: parseFloat(form.price_per_unit) || 0 };
    if (editingPosition) {
      const res = await api.put(`/positions/${editingPosition.id}`, data);
      setPositions((prev) => prev.map((p) => (p.id === editingPosition.id ? res.data : p)));
    } else {
      const res = await api.post("/positions", data);
      setPositions((prev) => [res.data, ...prev]);
    }
    setShowForm(false);
    setIsSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Leistung loeschen?")) {
      await api.delete(`/positions/${id}`);
      setPositions((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Leistungen"
            subtitle="Ihre Leistungsvorlagen fuer Rechnungen und Angebote"
            actions={
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Neue Leistung
              </button>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wrench className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-medium mb-1">Keine Leistungen vorhanden</p>
                <p className="text-sm text-muted-foreground mb-4">Erstellen Sie Leistungsvorlagen fuer schnellere Dokumenterstellung</p>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  Neue Leistung
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {positions.map((pos, index) => (
                  <motion.div
                    key={pos.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 group transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Wrench className="w-4 h-4 text-primary" />
                        </div>
                        <p className="font-medium text-foreground text-sm">{pos.name}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(pos)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(pos.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {pos.description && (
                      <p className="text-xs text-muted-foreground mb-3">{pos.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">{pos.unit}</span>
                      <span className="text-sm font-bold text-foreground">{formatCurrency(Number(pos.price_per_unit))}</span>
                    </div>
                  </motion.div>
                ))}
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
                {editingPosition ? "Leistung bearbeiten" : "Neue Leistung"}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="z.B. Installationsarbeit" className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Beschreibung</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Einheit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="Stueck">Stueck</option>
                    <option value="Stunden">Stunden</option>
                    <option value="m">m</option>
                    <option value="m2">m2</option>
                    <option value="m3">m3</option>
                    <option value="kg">kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Pauschal">Pauschal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Preis/Einheit (EUR)</label>
                  <input type="number" value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: e.target.value })} required min="0" step="0.01" placeholder="0,00" className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
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
