"use client";

import { cn } from "@/lib/utils";
import { isVencido } from "@/lib/colors";
import { keyOf } from "@/lib/format";
import type { Proyecto } from "@/lib/types";

export function KpiBar({ proyectos }: { proyectos: Proyecto[] }) {
  const total = proyectos.length;
  const venc = proyectos.filter((p) => isVencido(p.fecha_fin_estimada, p.estado)).length;
  const testing = proyectos.filter((p) => keyOf(p.estado) === "testing").length;
  const prom = total ? Math.round(proyectos.reduce((s, p) => s + (p.avance || 0), 0) / total) : 0;

  const kpis = [
    { n: total, l: "Proyectos (filtrados)", cls: "border-l-primary" },
    { n: venc, l: "Vencidos", cls: "border-l-destructive", num: venc > 0 ? "text-destructive" : "" },
    { n: testing, l: "En Testing", cls: "border-l-[#7048E8]", num: "text-[#7048E8]" },
    { n: `${prom}%`, l: "Avance promedio", cls: "border-l-[#2b8a3e]", num: "text-[#2b8a3e]" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {kpis.map((k) => (
        <div key={k.l} className={cn("flex-1 min-w-[140px] rounded-lg border border-l-4 bg-card px-4 py-3 shadow-sm", k.cls)}>
          <div className={cn("text-2xl font-extrabold", k.num)}>{k.n}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{k.l}</div>
        </div>
      ))}
    </div>
  );
}