import {
  GanttChart, History, KanbanSquare, LayoutDashboard, List, Settings,
  Shield, Tags, Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  Icon: typeof KanbanSquare;
  admin?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/tablero", label: "Tablero", Icon: KanbanSquare },
  { href: "/gantt", label: "Gantt global", Icon: GanttChart },
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/etiquetas", label: "Etiquetas", Icon: Tags },
  { href: "/listas", label: "Listas", Icon: List },
  { href: "/personal", label: "Personal", Icon: Users },
  { href: "/historial", label: "Historial", Icon: History },
];

export const NAV_ADMIN: NavItem[] = [
  { href: "/usuarios", label: "Usuarios", Icon: Shield, admin: true },
  { href: "/configuracion", label: "Configuración", Icon: Settings },
];