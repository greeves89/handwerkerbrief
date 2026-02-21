"use client";

import { motion } from "framer-motion";
import { FileText, Download, Eye, ArrowRight, Trash2, Send } from "lucide-react";
import Link from "next/link";
import { Document } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  getCustomerName,
  getStatusColor,
  getStatusLabel,
  isOverdue,
  cn,
} from "@/lib/utils";

interface DocumentListProps {
  documents: Document[];
  onDelete?: (id: number) => void;
  onDownload?: (id: number, number: string) => void;
  showActions?: boolean;
}

export function DocumentList({ documents, onDelete, onDownload, showActions = true }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-sm">Keine Dokumente vorhanden</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc, index) => {
        const customerName = getCustomerName(doc.customer);
        const statusColor = getStatusColor(doc.status, doc.type);
        const statusLabel = getStatusLabel(doc.status, doc.type);
        const overdue = doc.type === "invoice" && doc.status !== "paid" && isOverdue(doc.due_date);

        return (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={cn(
              "bg-card border rounded-xl px-5 py-4 hover:border-primary/30 transition-all group",
              overdue ? "border-destructive/30" : "border-border"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{doc.document_number}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor)}>
                    {statusLabel}
                  </span>
                  {overdue && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium text-destructive bg-destructive/10">
                      Überfällig
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground">{customerName}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{formatDate(doc.issue_date)}</span>
                  {doc.due_date && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                        Fällig: {formatDate(doc.due_date)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-bold text-foreground">{formatCurrency(doc.total_amount)}</span>
                {showActions && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={`/${doc.type === "invoice" ? "invoices" : "offers"}/${doc.id}`}>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                    {onDownload && (
                      <button
                        onClick={() => onDownload(doc.id, doc.document_number)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(doc.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
