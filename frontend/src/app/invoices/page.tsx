"use client";

import { useState } from "react";
import { Plus, Receipt, Crown, Zap } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentForm } from "@/components/documents/document-form";
import { useDocuments } from "@/hooks/use-documents";
import { useAuthStore } from "@/lib/auth";

const FREE_TIER_LIMIT = 3;

export default function InvoicesPage() {
  const { documents, isLoading, createDocument, deleteDocument, downloadPdf } = useDocuments("invoice");
  const [showForm, setShowForm] = useState(false);
  const user = useAuthStore((s: any) => s.user);

  const isFree = user?.subscription_tier !== "premium";
  // Count documents created this month
  const now = new Date();
  const thisMonthDocs = documents.filter((d: any) => {
    const created = new Date(d.created_at);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  });
  const monthCount = thisMonthDocs.length;
  const limitReached = isFree && monthCount >= FREE_TIER_LIMIT;

  const handleSave = async (data: any) => {
    await createDocument(data);
    setShowForm(false);
  };

  return (
    <MobileNavProvider>
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Rechnungen"
            subtitle={`${documents.length} Rechnungen`}
            actions={
              <button
                onClick={() => !limitReached && setShowForm(true)}
                disabled={limitReached}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Neue Rechnung
              </button>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Free tier banner */}
            {isFree && (
              <div className={`mb-4 rounded-xl border p-4 flex items-center justify-between ${
                limitReached
                  ? "border-destructive/30 bg-destructive/5"
                  : monthCount >= FREE_TIER_LIMIT - 1
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border bg-card/50"
              }`}>
                <div className="flex items-center gap-3">
                  <Crown className={`w-5 h-5 flex-shrink-0 ${limitReached ? "text-destructive" : "text-amber-500"}`} />
                  <div>
                    {limitReached ? (
                      <>
                        <p className="text-sm font-semibold text-destructive">Monatslimit erreicht ({monthCount}/{FREE_TIER_LIMIT})</p>
                        <p className="text-xs text-muted-foreground">Upgraden Sie auf Premium für unbegrenzte Rechnungen</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">Free-Tarif: {monthCount}/{FREE_TIER_LIMIT} Rechnungen diesen Monat</p>
                        <p className="text-xs text-muted-foreground">Premium: Unbegrenzte Rechnungen, Angebote & mehr</p>
                      </>
                    )}
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex-shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Upgrade – 0,99€/Monat
                </Link>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Receipt className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-medium mb-1">Keine Rechnungen vorhanden</p>
                <p className="text-sm text-muted-foreground mb-4">Erstellen Sie Ihre erste Rechnung</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Neue Rechnung
                </button>
              </div>
            ) : (
              <DocumentList
                documents={documents}
                onDelete={async (id) => { if (confirm("Rechnung loeschen?")) await deleteDocument(id); }}
                onDownload={downloadPdf}
              />
            )}
          </main>
        </div>
      </div>
      {showForm && (
        <DocumentForm
          type="invoice"
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </AuthGuard>
    </MobileNavProvider>
  );
}
