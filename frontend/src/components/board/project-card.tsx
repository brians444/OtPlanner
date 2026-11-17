"use client";

import { AlertTriangle, CalendarDays, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { PRIO_COLORS, riskInfo, tagColor } from "@/lib/colors";
import { fmtDate, initials, keyOf } from "@/lib/format";
import { tagsOf, type Comentario, type Etiqueta, type Proyecto } from "@/lib/types";

interface ProjectCardProps {
  p: Proyecto;
  etiquetas: Etiqueta[];
  comentarios: Comentario[];
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

export function ProjectCard({ p, etiquetas, comentarios, onOpen, onDragStart }: ProjectCardProps) {
  const tags = tagsOf(p);
  const risk = riskInfo(p.fecha_fin_estimada, p.estado, p.avance);
  const nCom = comentarios.filter(
    (c) => c.proyecto_id === p.id && !c.actividad_id
  ).length;
  const prioColor = PRIO_COLORS[keyOf(p.prioridad)] || "#e8590c";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={cn(
        "cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/50 active:cursor-grabbing",
        risk.cls === "venc" && "border-destructive/60",
        risk.cls === "risk" && "border-amber-500/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug line-clamp-2">{p.proyecto}</p>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ background: prioColor }}>
          {p.prioridad || "Media"}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[9px] font-bold">
          {initials(p.responsable)}
        </span>
        <span className="truncate">{p.responsable}</span>
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ background: tagColor(t, etiquetas) }}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <Progress value={p.avance} className="h-1.5 flex-1" />
        <span className="text-xs font-bold tabular-nums">{p.avance}%</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {fmtDate(p.fecha_fin_estimada)}
        </span>
        <span className="flex items-center gap-2">
          {nCom > 0 && (
            <span className="inline-flex items-center gap-0.5" title={`${nCom} mensajes`}>
              <MessageSquare className="h-3 w-3" />{nCom}
            </span>
          )}
          <span className="font-mono">{p.id}</span>
        </span>
      </div>
      {risk.lbl && (
        <div className={cn(
          "mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
          risk.cls === "venc" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}>
          {risk.cls === "venc" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {risk.lbl}
        </div>
      )}
    </div>
  );
}