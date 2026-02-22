"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Download, ArrowRight, Edit, Send } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DocumentForm } from "@/components/documents/document-form";
import api from "@/lib/api";
import { Document } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  getCustomerName,
  getStatusColor,
  getStatusLabel,
  cn,
} from "@/lib/utils";

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    api.get(`/documents/${params.id}`).then((r) => {
      setDocument(r.data);
      setIsLoading(false);
    });
  }, [params.id]);

  const handleDownload = async () => {
    if (!document) return;
    const res = await api.get(`/documents/${document.id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.document_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConvert = async () => {
    if (!document) return;
    if (confirm("Angebot in Rechnung umwandeln?")) {
      const res = await api.post(`/documents/${document.id}/convert-to-invoice`);
      router.push(`/invoices/${res.data.id}`);
    }
  };

  const handleConvertToOrderConfirmation = async () => {
    if (!document) return;
    if (confirm("Angebot in Auftragsbestätigung umwandeln?")) {
      const res = await api.post(`/documents/${document.id}/convert-to-order-confirmation`);
      router.push(`/offers/${res.data.id}`);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!document) return;
    const res = await api.put(`/documents/${document.id}`, { status });
    setDocument(res.data);
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="flex h-screen bg-background">
          <Sidebar />
          <div className="flex-1 ml-[260px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!document) return null;

  const statusColor = getStatusColor(document.status, "offer");
  const statusLabel = getStatusLabel(document.status, "offer");

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title={document.document_number}
            subtitle="Angebot"
            actions={
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                {document.status !== "accepted" && (
                  <>
                    <button
                      onClick={handleConvertToOrderConfirmation}
                      className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent"
                    >
                      <ArrowRight className="w-4 h-4" />
                      In Auftragsbestätigung
                    </button>
                    <button
                      onClick={handleConvert}
                      className="flex items-center gap-2 px-3 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90"
                    >
                      <ArrowRight className="w-4 h-4" />
                      In Rechnung umwandeln
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  <Edit className="w-4 h-4" />
                  Bearbeiten
                </button>
              </div>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">
            <Link href="/offers" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="w-4 h-4" />
              Zurueck zu Angeboten
            </Link>

            <div className="grid grid-cols-3 gap-6">
              {/* Main content */}
              <div className="col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-foreground">{document.title || "Angebot"}</h2>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", statusColor)}>
                      {statusLabel}
                    </span>
                  </div>
                  {document.intro_text && (
                    <p className="text-sm text-muted-foreground mb-4">{document.intro_text}</p>
                  )}

                  {/* Items table */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Bezeichnung</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Menge</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Preis</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Gesamt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.items.map((item) => (
                        <tr key={item.id} className="border-b border-border/50">
                          <td className="py-3">
                            <p className="font-medium text-foreground">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                            )}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            {formatCurrency(item.price_per_unit)}
                          </td>
                          <td className="py-3 text-right font-medium text-foreground">
                            {formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Zwischensumme</span>
                      <span>{formatCurrency(document.subtotal)}</span>
                    </div>
                    {Number(document.discount_percent) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rabatt ({document.discount_percent}%)</span>
                        <span className="text-destructive">-{formatCurrency(Number(document.subtotal) * Number(document.discount_percent) / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">MwSt. ({document.tax_rate}%)</span>
                      <span>{formatCurrency(document.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                      <span>Gesamt</span>
                      <span className="text-primary">{formatCurrency(document.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar info */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Kunde</dt>
                      <dd className="font-medium text-foreground text-right">{getCustomerName(document.customer)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Datum</dt>
                      <dd>{formatDate(document.issue_date)}</dd>
                    </div>
                    {document.valid_until && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Gueltig bis</dt>
                        <dd>{formatDate(document.valid_until)}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Status actions */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Status aendern</h3>
                  <div className="space-y-2">
                    {["draft", "sent", "accepted", "rejected", "expired"].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleUpdateStatus(s)}
                        disabled={document.status === s}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                          document.status === s
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-secondary text-secondary-foreground hover:bg-accent"
                        )}
                      >
                        {getStatusLabel(s, "offer")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {showEdit && (
        <DocumentForm
          document={document}
          type="offer"
          onSave={async (data) => {
            const res = await api.put(`/documents/${document.id}`, data);
            setDocument(res.data);
            setShowEdit(false);
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </AuthGuard>
  );
}
