export interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
  is_active: boolean;
  company_name?: string;
  address_street?: string;
  address_zip?: string;
  address_city?: string;
  address_country?: string;
  phone?: string;
  tax_number?: string;
  ustid?: string;
  iban?: string;
  bic?: string;
  bank_name?: string;
  invoice_prefix?: string;
  offer_prefix?: string;
  invoice_counter: number;
  offer_counter: number;
  subscription_tier: "free" | "premium";
  subscription_expires_at?: string;
  logo_path?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  user_id: number;
  customer_number?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_zip?: string;
  address_city?: string;
  address_country?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id?: number;
  document_id?: number;
  position: number;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_price: number;
}

export interface CustomerSummary {
  id: number;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface Document {
  id: number;
  user_id: number;
  customer_id: number;
  customer?: CustomerSummary;
  type: "offer" | "invoice";
  document_number: string;
  status: string;
  title?: string;
  intro_text?: string;
  closing_text?: string;
  issue_date: string;
  due_date?: string;
  valid_until?: string;
  discount_percent: number;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_terms?: string;
  notes?: string;
  pdf_path?: string;
  converted_from_id?: number;
  items: DocumentItem[];
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  unit: string;
  price_per_unit: number;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: number;
  user_id: number;
  type: "bug" | "feature" | "general";
  title: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  admin_response?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  total_users: number;
  premium_users: number;
  active_users: number;
  total_invoices: number;
  total_offers: number;
  total_revenue: number;
  pending_feedback: number;
}
