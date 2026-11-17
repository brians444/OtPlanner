"use client";

import { ArrowDown, ArrowUp, MessageSquare, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { estadoColor, riskInfo, tagColor } from "@/lib/colors";
import { daysBetween, keyOf, midnight, toDate } from "@/lib/format";
import type { GanttRange } from "./gantt-shared";
import type { Actividad, Comentario, Etiqueta, Subtarea } from "@/lib/types";

const ROWH = 39;

export function Header({ range, dayPx, actW }: { range: GanttRange; dayPx: number; actW: number }) {
  return (
    <div className="flex border-b bg-muted/50 text-[10px] font-semibold">
      <div className="shrink-0 border-r px-2 py-1 flex items-end" style={{ width: actW }}>Actividad</div>
      <div>
        <div className="flex">
          {range.months.map((m, i) => (
            <div key={i} className="border-r px-1 py-0.5 text-center uppercase truncate"
              style={{ width: m.span * dayPx }}>
              {m.span * dayPx > 34 ? m.label : ""}
            </div>
          ))}
        </div>
        <div className="flex border-t">
          {Array.from({ length: range.totalDays }, (_, i) => {
            const d = new Date(range.min);
            d.setDate(d.getDate() + i);
            const wk = d.getDay() === 0 || d.getDay() === 6;
            const today = i === range.todayOffset;
            return (
              <div key={i} className={cn("text-center py-0.5 tabular-nums",
                wk && "bg-muted text-muted-foreground", today && "bg-[#e8590c] text-white")}
                style={{ width: dayPx }}>
                {dayPx >= 12 ? d.getDate() : ""}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Row({ label, actW, rowW, gridBg, bands, height, children }: {
  label: React.ReactNode; actW: number; rowW: number;
  gridBg: React.CSSProperties; bands: React.ReactNode; height: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex border-b last:border-b-0">
      <div className="shrink-0 border-r px-2 text-xs flex items-center gap-1 min-w-0" style={{ width: actW, height }}>
        {label}
      </div>
      <div className="relative" style={{ width: rowW, height, ...gridBg }}>
        {bands}
        {children}
      </div>
    </div>
  );
}

interface ActRowProps {
  a: Actividad; idx: number; acts: Actividad[]; range: GanttRange;
  dayPx: number; actW: number; gridBg: React.CSSProperties; bands: React.ReactNode;
  drag: { id: string; dx: number } | null;
  etiquetas: Etiqueta[]; comentarios: Comentario[]; subtareas: Subtarea[];
  onEdit: () => void; onMoveRow: (idx: number, dir: -1 | 1) => void;
  onBarMouseDown: (e: React.MouseEvent) => void;
}

export function ActRow({ a, idx, acts, range, dayPx, actW, gridBg, bands, drag, etiquetas, comentarios, subtareas, onEdit, onMoveRow, onBarMouseDown }: ActRowProps) {
  const s = toDate(a.fecha_inicio), e = toDate(a.fecha_fin);
  const off = s ? daysBetween(range.min, midnight(s)) : 0;
  const dur = s && e ? Math.max(daysBetween(midnight(s), midnight(e)) + 1, 1) : 1;
  const k = keyOf(a.estado);
  const color = k === "completado" ? "#2b8a3e" : k === "testing" ? "#7048E8" : k === "pendiente" ? "#868e96" : "#2C7BE5";
  const risk = riskInfo(a.fecha_fin, a.estado, a.avance);
  const dx = drag?.id === a.id ? drag.dx : 0;
  const subDone = subtareas.filter((x) => x.hecha).length;

  return (
    <div className="flex border-b last:border-b-0 group">
      <div className="shrink-0 border-r px-2 flex flex-col justify-center gap-0.5 min-w-0" style={{ width: actW, height: ROWH }}>
        <div className="flex items-center gap-1 min-w-0">
          <button type="button" onClick={onEdit} className="truncate text-xs font-semibold text-left hover:underline flex-1" title={a.actividad}>
            {a.actividad}
          </button>
          <button type="button" aria-label="Editar" className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </button>
          <button type="button" aria-label="Subir" disabled={idx === 0}
            className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-25 opacity-0 group-hover:opacity-100"
            onClick={() => onMoveRow(idx, -1)}>
            <ArrowUp className="h-3 w-3" />
          </button>
          <button type="button" aria-label="Bajar" disabled={idx === acts.length - 1}
            className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-25 opacity-0 group-hover:opacity-100"
            onClick={() => onMoveRow(idx, 1)}>
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="font-mono">{a.id}</span>
          {a.etiqueta && (
            <span className="rounded-full px-1.5 text-white font-medium truncate max-w-[70px]"
              style={{ background: tagColor(a.etiqueta, etiquetas) }}>{a.etiqueta}</span>
          )}
          {a.depende_de && <span title={`Depende de ${a.depende_de}`}>⟵ {a.depende_de}</span>}
          {subtareas.length > 0 && <span title="Subtareas">☑ {subDone}/{subtareas.length}</span>}
          {comentarios.length > 0 && (
            <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{comentarios.length}</span>
          )}
          {risk.cls === "venc" && <span className="text-destructive font-bold" title={risk.lbl}>⚠</span>}
        </div>
      </div>
      <div className="relative" style={{ width: range.totalDays * dayPx, height: ROWH, ...gridBg }}>
        {bands}
        {s && (
          <div
            onMouseDown={onBarMouseDown}
            className={cn("absolute rounded cursor-grab active:cursor-grabbing overflow-hidden border border-black/10 shadow-sm",
              drag?.id === a.id && "opacity-80 z-[3]")}
            style={{ left: off * dayPx + dx, width: dur * dayPx, top: 9, height: ROWH - 18, background: color }}
            title={`${a.actividad} · ${a.avance}% · arrastrar para mover`}
          >
            <div className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${a.avance}%` }} />
            {dur * dayPx > 30 && (
              <span className="relative z-[1] px-1 text-[9px] font-bold text-white leading-[21px]">{a.avance}%</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DepSvg({ acts, range, dayPx, actW, extraRows }: {
  acts: Actividad[]; range: GanttRange; dayPx: number; actW: number; extraRows: number;
}) {
  const headerH = 33;
  const pos = new Map<string, { x1: number; x2: number; y: number }>();
  acts.forEach((a, i) => {
    const s = toDate(a.fecha_inicio), e = toDate(a.fecha_fin);
    if (!s) return;
    const off = daysBetween(range.min, midnight(s));
    const dur = e ? Math.max(daysBetween(midnight(s), midnight(e)) + 1, 1) : 1;
    pos.set(a.id, {
      x1: actW + off * dayPx,
      x2: actW + (off + dur) * dayPx,
      y: headerH + (extraRows + i) * ROWH + ROWH / 2,
    });
  });
  const paths: string[] = [];
  for (const a of acts) {
    if (!a.depende_de) continue;
    const from = pos.get(a.depende_de), to = pos.get(a.id);
    if (!from || !to) continue;
    const midX = from.x2 + Math.max((to.x1 - from.x2) / 2, 6);
    paths.push(`M ${from.x2} ${from.y} H ${midX} V ${to.y} H ${to.x1 - 3}`);
  }
  if (!paths.length) return null;
  const height = headerH + (extraRows + acts.length) * ROWH;
  return (
    <svg className="absolute left-0 top-0 pointer-events-none z-[2]"
      width={actW + range.totalDays * dayPx} height={height}>
      <defs>
        <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#e8590c" />
        </marker>
      </defs>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e8590c" strokeWidth="1.5" markerEnd="url(#gantt-arrow)" />
      ))}
    </svg>
  );
}