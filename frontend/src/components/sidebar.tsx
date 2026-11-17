"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, KanbanSquare, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNavLayout } from "@/hooks/use-nav-layout";
import { NAV_ADMIN, NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, toggleCollapsed } = useNavLayout();
  const adminItems = NAV_ADMIN.filter((i) => !i.admin || user?.is_admin);

  const renderItem = ({ href, label, Icon }: (typeof NAV_ITEMS)[number]) => {
    const active = pathname.startsWith(href);
    return (
      <Link key={href} href={href} title={label}>
        <Button
          variant={active ? "default" : "ghost"}
          className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start gap-2")}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </Button>
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "no-print fixed left-0 top-0 z-40 h-screen border-r bg-background flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("flex items-center h-14 border-b px-3", collapsed ? "justify-center" : "gap-2")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <KanbanSquare className="h-4 w-4" />
        </span>
        {!collapsed && <span className="font-bold truncate">PlannerOT</span>}
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV_ITEMS.map(renderItem)}
        <div className="border-t my-2 pt-2">
          {!collapsed && (
            <p className="px-3 pb-1 text-xs text-muted-foreground uppercase tracking-wider">Administración</p>
          )}
          {adminItems.map(renderItem)}
        </div>
      </nav>
      <div className="border-t p-2 space-y-1">
        {!collapsed && (
          <p className="px-3 py-1 text-sm text-muted-foreground truncate">
            {user?.display_name || user?.username}
          </p>
        )}
        <div className={cn("flex", collapsed ? "flex-col gap-1" : "gap-1")}>
          <Button variant="ghost" size="icon" onClick={toggleCollapsed}
            title={collapsed ? "Expandir" : "Colapsar"} aria-label="Colapsar menú">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}