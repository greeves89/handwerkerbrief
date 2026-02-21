"use client";

import { motion } from "framer-motion";
import { Building2, User, Mail, Phone, MapPin, Edit, Trash2 } from "lucide-react";
import { Customer } from "@/lib/types";
import { getCustomerName } from "@/lib/utils";

interface CustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (id: number) => void;
  index?: number;
}

export function CustomerCard({ customer, onEdit, onDelete, index = 0 }: CustomerCardProps) {
  const name = getCustomerName(customer);
  const hasCompany = !!customer.company_name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {hasCompany ? (
              <Building2 className="w-5 h-5 text-primary" />
            ) : (
              <User className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{name}</p>
            {customer.customer_number && (
              <p className="text-xs text-muted-foreground">{customer.customer_number}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(customer)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(customer.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {customer.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            <span>{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5" />
            <span>{customer.phone}</span>
          </div>
        )}
        {customer.address_city && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {[customer.address_zip, customer.address_city].filter(Boolean).join(" ")}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
