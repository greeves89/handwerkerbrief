"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Edit, Send, Bell, Truck, Link2, Check } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DocumentForm } from "@/components/documents/document-form";
import api from "@/lib/api";
import { Document } from "@/lib/types";
import { toast } from '@/hooks/use-toast'
import {
  formatCurrency,
  formatDate,
  getCustomerName,
  getStatusColor,
  getStatusLabel,
  cn,
} from "@/lib/utils";

export default function InvoiceDetailPage() {
  const params = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);

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

  const handleConvertToDeliveryNote = async () => {
    if (!document) return;
    if (confirm("Lieferschein aus dieser Rechnung erstellen?")) {
      const res = await api.post(`/documents/${document.id}/convert-to-delivery-note`);
      toast(`Lieferschein ${res.data.document_number} wurde erstellt.`, 'success')
    }
  };

  const handleSendReminder = async (level: number) => {
    if (!document) return;
    try {
      await api.post(`/documents/${document.id}/send-reminder`, { level });
      toast(`Mahnung Level ${level} wurde gesendet!`, 'success')
    } catch (err: any) {
      toast(err.response?.data?.detail || "Fehler beim Senden der Mahnung", 'error')
    }
  };

  const handleCopyPortalLink = async () => {
    if (!document) return;
    try {
      const res = await api.post(`/portal/documents/${document.id}/generate-link`);
      const url = res.data.portal_url;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = window.document.createElement('textarea');
        el.value = url;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        window.document.body.appendChild(el);
        el.select();
        window.document.execCommand('copy');
        window.document.body.removeChild(el);
      }
      setPortalCopied(true);
      setTimeout(() => setPortalCopied(false), 3000);
    } catch (err: any) {
      toast(err.response?.data?.detail || "Fehler beim Erstellen des Portal-Links", 'error')
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

  const statusColor = getStatusColor(document.status, "invoice");
  const statusLabel = getStatusLabel(document.status, "invoice");
  const isOverdueDoc = document.status !== "paid" && document.due_date && new Date(document.due_date) < new Date();

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 ml-[260px] flex flex-col overflow-hidden">
          <Header
            title={document.document_number}
            subtitle="Rechnung"
            actions={
              <div className="flex gap-2">
                <button
                  onClick={handleCopyPortalLink}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent"
                >
                  {portalCopied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
                  {portalCopied ? "Link kopiert!" : "Kundenlink"}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={handleConvertToDeliveryNote}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent"
                >
                  <Truck className="w-4 h-4" />
                  Lieferschein
                </button>
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
            <Link href="/invoices" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="w-4 h-4" />
              Zurueck zu Rechnungen
            </Link>

            {isOverdueDoc && (
              <div className="mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive font-medium">
                Diese Rechnung ist ueberfaellig! Faelligkeitsdatum: {formatDate(document.due_date)}
              </div>
            )}

            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-foreground">{document.title || "Rechnung"}</h2>
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", statusColor)}>
                      {statusLabel}
                    </span>
                  </div>
                  {document.intro_text && (
                    <p className="text-sm text-muted-foreground mb-4">{document.intro_text}</p>
                  )}

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
                          <td className="py-3 text-right text-muted-foreground">{item.quantity} {item.unit}</td>
                          <td className="py-3 text-right text-muted-foreground">{formatCurrency(item.price_per_unit)}</td>
                          <td className="py-3 text-right font-medium text-foreground">{formatCurrency(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

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

                  {document.payment_terms && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">{document.payment_terms}</p>
                    </div>
                  )}
                </div>
              </div>

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
                    {document.due_date && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Faellig am</dt>
                        <dd className={isOverdueDoc ? "text-destructive font-medium" : ""}>{formatDate(document.due_date)}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Status</h3>
                  <div className="space-y-2">
                    {["draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
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
                        {getStatusLabel(s, "invoice")}
                      </button>
                    ))}
                  </div>
                </div>

                {document.status !== "paid" && (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Mahnwesen</h3>
                    <div className="space-y-2">
                      {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          onClick={() => handleSendReminder(level)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-warning/10 text-warning border border-warning/20 rounded-lg text-xs font-medium hover:bg-warning/20 transition-colors"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          {level === 1 ? "Zahlungserinnerung" : `${level - 1}. Mahnung`} senden
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {showEdit && (
        <DocumentForm
          document={document}
          type="invoice"
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
