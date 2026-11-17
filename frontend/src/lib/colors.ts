import { daysBetween, keyOf, midnight, toDate } from "./format";
import type { Etiqueta } from "./types";

export const ESTADO_COLORS: Record<string, string> = {
  pendiente: "#495057",
  "en progreso": "#2C7BE5",
  testing: "#7048E8",
  "en revision": "#e8590c",
  completado: "#2b8a3e",
  cancelado: "#868e96",
};

export const PALETTE = [
  "#0C8599", "#F76707", "#AE3EC9", "#1971C2", "#2F9E44",
  "#E8590C", "#5C7CFA", "#F08C00", "#12489C", "#E64980",
];

export const DEM_COLORS: Record<string, string> = {
  alta: "#e03131", media: "#e8590c", baja: "#2b8a3e",
};

export const PRIO_COLORS: Record<string, string> = {
  alta: "#e03131", media: "#e8590c", baja: "#2b8a3e",
};

export const AUS_COLORS: Record<string, string> = {
  vacaciones: "#0C8599", tramite: "#7048E8", franco: "#F76707", "franco generado": "#2b8a3e",
};

export function estadoColor(name: string, index: number): string {
  return ESTADO_COLORS[keyOf(name)] || PALETTE[index % PALETTE.length];
}

export function tagColor(name: string, etiquetas: Etiqueta[]): string {
  const t = etiquetas.find((x) => keyOf(x.etiqueta) === keyOf(name));
  return t && t.color_hex ? "#" + t.color_hex.replace("#", "") : "#495057";
}

export function tagCat(name: string, etiquetas: Etiqueta[]): string {
  const t = etiquetas.find((x) => keyOf(x.etiqueta) === keyOf(name));
  return t ? t.categoria : "";
}

export interface Risk { cls: "" | "venc" | "risk"; lbl: string }

export function riskInfo(finEst: string | null, estado: string, pct: number): Risk {
  const d = toDate(finEst);
  if (!d) return { cls: "", lbl: "" };
  const k = keyOf(estado);
  if (k === "completado" || k === "cancelado" || pct >= 100) return { cls: "", lbl: "" };
  const hoy = midnight(new Date());
  const dd = daysBetween(hoy, midnight(d));
  if (dd < 0) return { cls: "venc", lbl: `Vencido (${-dd}d)` };
  if (dd <= 3) return { cls: "risk", lbl: `Vence en ${dd}d` };
  return { cls: "", lbl: "" };
}

export function isVencido(finEst: string | null, estado: string): boolean {
  const d = toDate(finEst);
  if (!d) return false;
  const k = keyOf(estado);
  return midnight(d) < midnight(new Date()) && k !== "completado" && k !== "cancelado";
}