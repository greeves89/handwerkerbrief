"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Wrench,
  MessageSquare,
  Settings,
  Shield,
  HardHat,
  Mail,
  Timer,
  RefreshCw,
  UserPlus,
  Camera,
  Archive,
  FileSpreadsheet,
  ScanLine,
  Landmark,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useMobileNav } from "./mobile-nav-context";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Kunden", icon: Users },
  { href: "/offers", label: "Angebote", icon: FileText },
  { href: "/invoices", label: "Rechnungen", icon: Receipt },
  { href: "/positions", label: "Leistungen", icon: Wrench },
  { href: "/time-entries", label: "Zeiterfassung", icon: Timer },
  { href: "/recurring-invoices", label: "Abo-Rechnungen", icon: RefreshCw },
  { href: "/site-reports", label: "Baustellenabnahme", icon: Camera },
  { href: "/archive", label: "GoBD-Archiv", icon: Archive },
  { href: "/ocr", label: "Belegscanner", icon: ScanLine },
  { href: "/bank", label: "Bankabgleich", icon: Landmark },
  { href: "/tax", label: "UStVA / ELSTER", icon: FileSpreadsheet },
  { href: "/team", label: "Team", icon: UserPlus },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

const adminItems = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/admin/email-templates", label: "E-Mail Templates", icon: Mail },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <aside className="h-full w-[260px] bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <HardHat className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <span className="font-bold text-foreground text-sm">HandwerkerBrief</span>
          <p className="text-xs text-muted-foreground">
            {user?.subscription_tier === "premium" ? "Premium" : "Free"}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </motion.div>
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <>
              <div className="my-3 border-t border-border" />
              <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Admin
              </p>
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </motion.div>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </nav>

      {/* User info at bottom */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Sidebar() {
  const { isOpen, close } = useMobileNav();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block flex-shrink-0 h-screen">
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={close}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
            >
              <SidebarContent onClose={close} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
