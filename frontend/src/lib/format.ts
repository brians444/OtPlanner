export function norm(s: unknown): string {
  return s == null ? "" : String(s).trim();
}

export function keyOf(s: unknown): string {
  return norm(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(s: string | null | undefined): string {
  const d = toDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(s: string | null | undefined): string {
  const d = toDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function estadoFromPct(pct: number): string {
  return pct >= 100 ? "Completado" : pct > 0 ? "En progreso" : "Pendiente";
}

export function isChecklistMode(modo: string): boolean {
  return keyOf(modo) === "checklist";
}

export function isFinalEstado(estado: string): boolean {
  return keyOf(estado) === "completado" || keyOf(estado) === "cancelado";
}

export function pctColor(pct: number): string {
  if (pct >= 100) return "hsl(142 71% 45%)";
  if (pct >= 60) return "hsl(199 89% 48%)";
  if (pct > 0) return "hsl(38 92% 50%)";
  return "hsl(215 16% 65%)";
}

export function initials(name: string): string {
  return norm(name).split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join("") || "?";
}