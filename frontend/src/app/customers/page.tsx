"use client";

import { useState } from "react";
import { Plus, Search, Users, Upload } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CustomerCard } from "@/components/customers/customer-card";
import { CustomerForm } from "@/components/customers/customer-form";
import { InvoiceHistoryPanel } from "@/components/customers/invoice-history-panel";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { useCustomers } from "@/hooks/use-customers";
import { Customer } from "@/lib/types";

export default function CustomersPage() {
  const { customers, isLoading, createCustomer, updateCustomer, deleteCustomer, importCustomersCsv, downloadCustomerTemplate } = useCustomers();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [historyCustomer, setHistoryCustomer] = useState<Customer | undefined>();
  const [search, setSearch] = useState("");

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.company_name?.toLowerCase().includes(q) ||
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const handleSave = async (data: Partial<Customer>) => {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, data);
    } else {
      await createCustomer(data);
    }
    setShowForm(false);
    setEditingCustomer(undefined);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Kunden wirklich loeschen?")) {
      await deleteCustomer(id);
    }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title="Kunden"
            subtitle={`${customers.length} Kunden insgesamt`}
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  CSV-Import
                </button>
                <button
                  onClick={() => { setEditingCustomer(undefined); setShowForm(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Neuer Kunde
                </button>
              </div>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kunden suchen..."
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-medium mb-1">Keine Kunden gefunden</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {search ? "Suchanfrage anpassen oder" : "Erstellen Sie Ihren ersten Kunden"}
                </p>
                {!search && (
                  <button
                    onClick={() => { setEditingCustomer(undefined); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4" />
                    Neuer Kunde
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((customer, index) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onViewHistory={(c) => setHistoryCustomer(c)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingCustomer(undefined); }}
        />
      )}

      {historyCustomer && (
        <InvoiceHistoryPanel
          customer={historyCustomer}
          onClose={() => setHistoryCustomer(undefined)}
        />
      )}

      {showImport && (
        <CsvImportDialog
          title="Kunden importieren"
          description="Importieren Sie Kunden aus einer CSV-Datei. Laden Sie zuerst die Vorlage herunter, um das korrekte Format zu sehen."
          templateFilename="kunden_vorlage.csv"
          onClose={() => setShowImport(false)}
          onImport={importCustomersCsv}
          onDownloadTemplate={downloadCustomerTemplate}
        />
      )}
    </AuthGuard>
  );
}
