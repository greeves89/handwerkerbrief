"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from '@/hooks/use-toast'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface PortalItem {
  position: number;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_price: number;
}

interface PortalDocument {
  document_number: string;
  type: string;
  status: string;
  title?: string;
  intro_text?: string;
  closing_text?: string;
  issue_date?: string;
  due_date?: string;
  valid_until?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  discount_percent: number;
  payment_terms?: string;
  notes?: string;
  items: PortalItem[];
  customer: {
    name: string;
    address_street?: string;
    address_zip?: string;
    address_city?: string;
  };
  company: {
    name: string;
    email: string;
  };
}

function formatEuro(val: number): string {
  return val.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const TYPE_LABELS: Record<string, string> = {
  invoice: "Rechnung",
  offer: "Angebot",
  order_confirmation: "Auftragsbestätigung",
  delivery_note: "Lieferschein",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Entwurf", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  sent: { label: "Gesendet", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  paid: { label: "Bezahlt", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  overdue: { label: "Überfällig", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  cancelled: { label: "Storniert", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  accepted: { label: "Angenommen", color: "bg-green-500/10 text-green-400 border-green-500/20" },
};

export default function PortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [doc, setDoc] = useState<PortalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/portal/view/${token}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Dokument nicht gefunden");
        }
        return res.json();
      })
      .then((data) => {
        setDoc(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [token]);

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/portal/view/${token}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("PDF konnte nicht geladen werden");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${doc?.document_number ?? "dokument"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast(err.message || "Fehler beim Herunterladen", 'error')
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-2">Dokument nicht gefunden</h1>
          <p className="text-sm text-muted-foreground">{error || "Der Link ist ungültig oder abgelaufen."}</p>
        </div>
      </div>
    );
  }

  const typeLabel = TYPE_LABELS[doc.type] ?? doc.type;
  const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, color: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
  const isOverdue = doc.status !== "paid" && doc.due_date && new Date(doc.due_date) < new Date();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{doc.company.name}</p>
              <p className="text-xs text-muted-foreground">Kundenportal</p>
            </div>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PDF herunterladen
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Status Banner */}
        {isOverdue && (
          <div className="flex items-center gap-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Diese Rechnung ist überfällig. Fälligkeitsdatum: {formatDate(doc.due_date)}
          </div>
        )}
        {doc.status === "paid" && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400 font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Diese Rechnung wurde bereits beglichen. Vielen Dank!
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Main document */}
          <div className="col-span-2 space-y-5">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{typeLabel}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-foreground">{doc.document_number}</h1>
                  {doc.title && <p className="text-sm text-muted-foreground mt-0.5">{doc.title}</p>}
                </div>
              </div>

              {doc.intro_text && (
                <p className="text-sm text-muted-foreground mb-5 pb-5 border-b border-border">{doc.intro_text}</p>
              )}

              {/* Items table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Bezeichnung</th>
                    <th className="text-right py-2 text-muted-foreground font-medium w-20">Menge</th>
                    <th className="text-right py-2 text-muted-foreground font-medium w-24">Preis</th>
                    <th className="text-right py-2 text-muted-foreground font-medium w-24">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, i) => (
                    <tr key={i} className="border-b border-border/50">
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
                        {formatEuro(item.price_per_unit)}
                      </td>
                      <td className="py-3 text-right font-medium text-foreground">
                        {formatEuro(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Zwischensumme</span>
                  <span className="text-foreground">{formatEuro(doc.subtotal)}</span>
                </div>
                {doc.discount_percent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rabatt ({doc.discount_percent}%)</span>
                    <span className="text-destructive">-{formatEuro(doc.subtotal * doc.discount_percent / 100)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">MwSt. ({doc.tax_rate}%)</span>
                  <span className="text-foreground">{formatEuro(doc.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                  <span className="text-foreground">Gesamtbetrag</span>
                  <span className="text-primary">{formatEuro(doc.total_amount)}</span>
                </div>
              </div>

              {doc.payment_terms && (
                <p className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">{doc.payment_terms}</p>
              )}

              {doc.closing_text && (
                <p className="mt-4 text-sm text-muted-foreground">{doc.closing_text}</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Details</h3>
              <dl className="space-y-2.5 text-sm">
                {doc.issue_date && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Ausgestellt am</dt>
                    <dd className="text-foreground font-medium">{formatDate(doc.issue_date)}</dd>
                  </div>
                )}
                {doc.due_date && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Fällig am</dt>
                    <dd className={`font-medium ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                      {formatDate(doc.due_date)}
                    </dd>
                  </div>
                )}
                {doc.valid_until && (
                  <div>
                    <dt className="text-xs text-muted-foreground mb-0.5">Gültig bis</dt>
                    <dd className="text-foreground font-medium">{formatDate(doc.valid_until)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Rechnungssteller</h3>
              <p className="text-sm font-medium text-foreground">{doc.company.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{doc.company.email}</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Rechnungsempfänger</h3>
              <p className="text-sm font-medium text-foreground">{doc.customer.name}</p>
              {doc.customer.address_street && (
                <p className="text-xs text-muted-foreground mt-0.5">{doc.customer.address_street}</p>
              )}
              {(doc.customer.address_zip || doc.customer.address_city) && (
                <p className="text-xs text-muted-foreground">
                  {doc.customer.address_zip} {doc.customer.address_city}
                </p>
              )}
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              PDF herunterladen
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-6">
          Dieses Dokument wurde über HandwerkerBrief bereitgestellt. Powered by HandwerkerBrief.de
        </p>
      </main>
    </div>
  );
}
