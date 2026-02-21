"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";

export function UserMenu() {
  const { user, logout } = useAuthStore();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors">
          <span className="text-sm font-bold text-primary">
            {user?.name?.charAt(0).toUpperCase()}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] bg-card border border-border rounded-xl shadow-xl p-1 z-50 animate-slide-up"
          sideOffset={8}
          align="end"
        >
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenu.Separator className="h-px bg-border my-1" />
          <DropdownMenu.Item asChild>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg hover:bg-accent cursor-pointer outline-none"
            >
              <Settings className="w-4 h-4" />
              Einstellungen
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-border my-1" />
          <DropdownMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-sm text-destructive rounded-lg hover:bg-destructive/10 cursor-pointer outline-none"
            onSelect={() => logout()}
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
