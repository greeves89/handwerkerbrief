"use client";

import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentForm } from "@/components/documents/document-form";
import { useDocuments } from "@/hooks/use-documents";

export default function OffersPage() {
  const { documents, isLoading, createDocument, deleteDocument, downloadPdf } = useDocuments("offer");
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (data: any) => {
    await createDocument(data);
    setShowForm(false);
  };

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title="Angebote"
            subtitle={`${documents.length} Angebote`}
            actions={
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Neues Angebot
              </button>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-foreground font-medium mb-1">Keine Angebote vorhanden</p>
                <p className="text-sm text-muted-foreground mb-4">Erstellen Sie Ihr erstes Angebot</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Neues Angebot
                </button>
              </div>
            ) : (
              <DocumentList
                documents={documents}
                onDelete={async (id) => { if (confirm("Angebot loeschen?")) await deleteDocument(id); }}
                onDownload={downloadPdf}
              />
            )}
          </main>
        </div>
      </div>
      {showForm && (
        <DocumentForm
          type="offer"
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}
    </AuthGuard>
  );
}
