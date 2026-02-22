"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Receipt, CheckCircle, AlertCircle, Clock, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { Customer, CustomerInvoiceSummary } from "@/lib/types";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, getCustomerName } from "@/lib/utils";

interface InvoiceHistoryPanelProps {
  customer: Customer;
  onClose: () => void;
}

export function InvoiceHistoryPanel({ customer, onClose }: InvoiceHistoryPanelProps) {
  const [summary, setSummary] = useState<CustomerInvoiceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/customers/${customer.id}/invoice-summary`);
        setSummary(res.data);
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, [customer.id]);

  const customerName = getCustomerName(customer);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Rechnungshistorie</h2>
                <p className="text-xs text-muted-foreground">{customerName}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !summary ? (
            <div className="flex-1 flex items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">Fehler beim Laden der Daten</p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-px bg-border flex-shrink-0">
                <div className="bg-card px-3 py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Gesamt</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(summary.total_invoiced)}</p>
                </div>
                <div className="bg-card px-3 py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Bezahlt</p>
                  <p className="text-base font-bold text-green-500">{formatCurrency(summary.total_paid)}</p>
                </div>
                <div className="bg-card px-3 py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Offen</p>
                  <p className="text-base font-bold text-amber-500">{formatCurrency(summary.total_outstanding)}</p>
                </div>
                <div className="bg-card px-3 py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Überfällig</p>
                  <p className="text-base font-bold text-red-500">{formatCurrency(summary.total_overdue)}</p>
                </div>
              </div>

              {/* Invoice list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {summary.invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Receipt className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Keine Rechnungen für diesen Kunden</p>
                  </div>
                ) : (
                  summary.invoices.map((inv, i) => {
                    const statusColor = getStatusColor(inv.status);
                    const statusLabel = getStatusLabel(inv.status);
                    return (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center justify-between p-3.5 rounded-xl border ${
                          inv.is_overdue
                            ? "border-red-500/20 bg-red-500/5"
                            : inv.status === "paid"
                            ? "border-green-500/20 bg-green-500/5"
                            : "border-border bg-secondary/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {inv.status === "paid" ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : inv.is_overdue ? (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{inv.document_number}</p>
                              {inv.title && (
                                <p className="text-xs text-muted-foreground truncate max-w-[160px]">{inv.title}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusColor}`}>
                                {statusLabel}
                              </span>
                              {inv.issue_date && (
                                <span className="text-xs text-muted-foreground">
                                  Ausgestellt: {formatDate(inv.issue_date)}
                                </span>
                              )}
                              {inv.due_date && inv.status !== "paid" && (
                                <span className={`text-xs ${inv.is_overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                  Fällig: {formatDate(inv.due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(inv.total_amount)}
                          </p>
                          {inv.status !== "paid" && (
                            <p className="text-xs text-amber-500">offen</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Footer stats */}
              {summary.invoice_count > 0 && (
                <div className="border-t border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{summary.invoice_count} Rechnungen insgesamt</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Zahlungsquote:{" "}
                    <span className="font-medium text-foreground">
                      {summary.total_invoiced > 0
                        ? Math.round((summary.total_paid / summary.total_invoiced) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
