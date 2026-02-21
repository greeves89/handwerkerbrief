import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getCustomerName(customer: {
  company_name?: string;
  first_name?: string;
  last_name?: string;
} | undefined): string {
  if (!customer) return "Unbekannt";
  if (customer.company_name) return customer.company_name;
  const parts = [customer.first_name, customer.last_name].filter(Boolean);
  return parts.join(" ") || "Unbekannt";
}

export function getStatusColor(status: string, type?: string): string {
  const invoiceColors: Record<string, string> = {
    draft: "text-muted-foreground bg-muted",
    sent: "text-info bg-info/10",
    paid: "text-success bg-success/10",
    overdue: "text-destructive bg-destructive/10",
    cancelled: "text-muted-foreground bg-muted",
  };
  const offerColors: Record<string, string> = {
    draft: "text-muted-foreground bg-muted",
    sent: "text-info bg-info/10",
    accepted: "text-success bg-success/10",
    rejected: "text-destructive bg-destructive/10",
    expired: "text-warning bg-warning/10",
  };
  const map = type === "offer" ? offerColors : invoiceColors;
  return map[status] || "text-muted-foreground bg-muted";
}

export function getStatusLabel(status: string, type?: string): string {
  const invoiceLabels: Record<string, string> = {
    draft: "Entwurf",
    sent: "Gesendet",
    paid: "Bezahlt",
    overdue: "Überfällig",
    cancelled: "Storniert",
  };
  const offerLabels: Record<string, string> = {
    draft: "Entwurf",
    sent: "Gesendet",
    accepted: "Angenommen",
    rejected: "Abgelehnt",
    expired: "Abgelaufen",
  };
  const map = type === "offer" ? offerLabels : invoiceLabels;
  return map[status] || status;
}

export function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}
