"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KanbanSquare, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { NAV_ADMIN, NAV_ITEMS } from "./nav-items";

export function Navbar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const items = [...NAV_ITEMS, ...NAV_ADMIN.filter((i) => !i.admin || user?.is_admin)];

  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4">
        {onMenu && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Menú">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <Link href="/tablero" className="flex items-center gap-2 font-bold mr-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <KanbanSquare className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">PlannerOT</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
          {items.map(({ href, label, Icon }) => (
            <Link key={href} href={href}>
              <Button variant={pathname.startsWith(href) ? "default" : "ghost"} size="sm" className="gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </nav>
        <div className="flex-1 lg:hidden" />
        <span className="hidden md:inline text-sm text-muted-foreground mr-2">
          {user?.display_name || user?.username}
        </span>
        <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      <nav className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
        {items.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="shrink-0">
            <Button variant={pathname.startsWith(href) ? "default" : "ghost"} size="sm" className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!open) return null;
  const items = [...NAV_ITEMS, ...NAV_ADMIN.filter((i) => !i.admin || user?.is_admin)];
  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute left-0 top-0 h-full w-64 bg-background border-r p-4 space-y-1 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {items.map(({ href, label, Icon }) => (
          <Link key={href} href={href} onClick={onClose}>
            <Button variant={pathname.startsWith(href) ? "default" : "ghost"} className="w-full justify-start gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}