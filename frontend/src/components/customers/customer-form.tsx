"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Customer } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CustomerFormProps {
  customer?: Customer;
  onSave: (data: Partial<Customer>) => Promise<void>;
  onCancel: () => void;
}

export function CustomerForm({ customer, onSave, onCancel }: CustomerFormProps) {
  const [form, setForm] = useState({
    company_name: customer?.company_name || "",
    first_name: customer?.first_name || "",
    last_name: customer?.last_name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    address_street: customer?.address_street || "",
    address_zip: customer?.address_zip || "",
    address_city: customer?.address_city || "",
    address_country: customer?.address_country || "Deutschland",
    notes: customer?.notes || "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name && !form.first_name && !form.last_name) {
      setError("Bitte Firmenname oder Vor-/Nachname angeben");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setIsLoading(false);
    }
  };

  const field = (label: string, name: keyof typeof form, placeholder?: string, type = "text") => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {customer ? "Kunde bearbeiten" : "Neuer Kunde"}
          </h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}
          {field("Firmenname", "company_name", "Mustermann GmbH")}
          <div className="grid grid-cols-2 gap-4">
            {field("Vorname", "first_name", "Max")}
            {field("Nachname", "last_name", "Mustermann")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field("E-Mail", "email", "max@mustermann.de", "email")}
            {field("Telefon", "phone", "+49 123 456789")}
          </div>
          {field("Straße", "address_street", "Musterstraße 1")}
          <div className="grid grid-cols-3 gap-4">
            {field("PLZ", "address_zip", "12345")}
            {field("Stadt", "address_city", "Berlin")}
            {field("Land", "address_country", "Deutschland")}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Interne Notizen..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
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
