"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Flag, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiError } from "@/lib/api";
import { actividadService, hitoService } from "@/lib/services";
import { AUS_COLORS, estadoColor, riskInfo, tagColor } from "@/lib/colors";
import { daysBetween, fmtDate, keyOf, midnight, toDate } from "@/lib/format";
import { computeRange, loadWidths, saveWidths } from "./gantt-shared";
import { ActRow, DepSvg, Header, Row } from "./gantt-parts";
import { ActividadModal } from "./actividad-modal";
import { HitoModal } from "./hito-modal";
import type { Actividad, Ausencia, Comentario, Etiqueta, Hito, Persona, Proyecto, Subtarea } from "@/lib/types";

const ROWH = 39;

interface Props {
  proyecto: Proyecto;
  actividades: Actividad[];
  subtareas: Subtarea[];
  comentarios: Comentario[];
  hitos: Hito[];
  etiquetas: Etiqueta[];
  personal: Persona[];
  ausencias: Ausencia[];
}

export function GanttPanel(props: Props) {
  const { proyecto, actividades, hitos, etiquetas, personal, ausencias } = props;
  const qc = useQueryClient();
  const [widths, setWidths] = useState(loadWidths);
  const { dayPx, actW } = widths;
  const [editAct, setEditAct] = useState<Actividad | null>(null);
  const [editHito, setEditHito] = useState<Hito | "new" | null>(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<{ id: string; startX: number; dx: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["snapshot"] });
  const onError = (e: unknown) => setError(apiError(e));

  const acts = useMemo(
    () => [...actividades].sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id)),
    [actividades]
  );

  const range = useMemo(
    () => computeRange(
      [...acts.map((a) => a.fecha_inicio), ...hitos.map((h) => h.fecha)],
      [...acts.map((a) => a.fecha_fin), ...hitos.map((h) => h.fecha)]
    ),
    [acts, hitos]
  );
  const rowW = range.totalDays * dayPx;

  const move = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => actividadService.move(id, delta),
    onSuccess: invalidate, onError,
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => actividadService.reorder(ids),
    onSuccess: invalidate, onError,
  });

  const addAct = useMutation({
    mutationFn: () => actividadService.create({
      proyecto_id: proyecto.id, actividad: "Nueva actividad",
    }),
    onSuccess: (a) => { invalidate(); setEditAct(a); },
    onError,
  });

  const delHito = useMutation({
    mutationFn: (id: string) => hitoService.remove(id),
    onSuccess: invalidate, onError,
  });

  const setW = (k: "dayPx" | "actW", v: number) => {
    const next = { ...widths, [k]: v };
    setWidths(next);
    saveWidths(next.dayPx, next.actW);
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    const ids = acts.map((a) => a.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder.mutate(ids);
  };

  const onBarMouseDown = (a: Actividad) => (e: React.MouseEvent) => {
    if (!a.fecha_inicio || !a.fecha_fin) return;
    e.preventDefault();
    const startX = e.clientX;
    setDrag({ id: a.id, startX, dx: 0 });
    const onMove = (ev: MouseEvent) => setDrag({ id: a.id, startX, dx: ev.clientX - startX });
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDrag(null);
      const delta = Math.round((ev.clientX - startX) / dayPx);
      if (delta !== 0) move.mutate({ id: a.id, delta });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const awayNames = [proyecto.responsable, proyecto.responsable_tecnico, proyecto.project_leader]
    .map((n) => keyOf(n)).filter(Boolean);
  const teamAus = ausencias.filter((a) => {
    if (keyOf(a.tipo) === "franco generado") return false;
    const per = personal.find((p) => p.id === a.persona_id);
    if (!per || !awayNames.includes(keyOf(per.nombre))) return false;
    const s = toDate(a.desde), e = toDate(a.hasta);
    return s && e && !(midnight(e) < range.min || midnight(s) > range.max);
  });

  const avg = acts.length ? Math.round(acts.reduce((s, a) => s + a.avance, 0) / acts.length) : 0;
  const done = acts.filter((a) => keyOf(a.estado) === "completado").length;
  const withDep = acts.filter((a) => a.depende_de).length;

  const gridBg = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${dayPx - 1}px, hsl(var(--border)) ${dayPx - 1}px, hsl(var(--border)) ${dayPx}px)`,
  };

  const bands = (
    <>
      {range.weekendOffsets.map((o) => (
        <span key={o} className="absolute top-0 bottom-0 bg-muted/60 pointer-events-none"
          style={{ left: o * dayPx, width: dayPx }} />
      ))}
      {range.todayOffset >= 0 && (
        <span className="absolute top-0 bottom-0 w-0.5 bg-[#e8590c] pointer-events-none z-[2]"
          style={{ left: range.todayOffset * dayPx + dayPx / 2 }} title="Hoy" />
      )}
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border bg-muted/40 px-2.5 py-1.5"><b className="text-sm">{acts.length}</b> actividades</span>
        <span className="rounded-md border bg-muted/40 px-2.5 py-1.5"><b className="text-sm">{avg}%</b> avance</span>
        <span className="rounded-md border bg-muted/40 px-2.5 py-1.5"><b className="text-sm">{done}</b> completadas</span>
        <span className="rounded-md border bg-muted/40 px-2.5 py-1.5"><b className="text-sm">{withDep}</b> con dependencia</span>
        {hitos.length > 0 && <span className="rounded-md border bg-muted/40 px-2.5 py-1.5"><b className="text-sm">{hitos.length}</b> hitos</span>}
        <span className="flex-1" />
        <label className="flex items-center gap-1.5">Día
          <input type="range" min={6} max={60} value={dayPx} className="w-20 accent-[hsl(var(--primary))]"
            onChange={(e) => setW("dayPx", parseInt(e.target.value, 10))} />
          <span className="tabular-nums w-9">{dayPx}px</span>
        </label>
        <label className="flex items-center gap-1.5">Nombres
          <input type="range" min={120} max={600} value={actW} className="w-20 accent-[hsl(var(--primary))]"
            onChange={(e) => setW("actW", parseInt(e.target.value, 10))} />
          <span className="tabular-nums w-10">{actW}px</span>
        </label>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Restaurar anchos"
          onClick={() => { setWidths({ dayPx: 16, actW: 230 }); saveWidths(16, 230); }}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => addAct.mutate()} disabled={acts.length >= 10}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Actividad
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditHito("new")}>
          <Flag className="mr-1 h-3.5 w-3.5" /> Hito
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        Arrastrá una barra horizontalmente para reprogramar (las dependientes se mueven en cascada). Clic en el nombre para editar.
      </p>

      {acts.length === 0 ? (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          Este proyecto no tiene actividades. Agregá la primera con el botón de arriba.
        </p>
      ) : (
        <div ref={chartRef} className="overflow-x-auto rounded-lg border print-area">
          <div style={{ width: actW + rowW }}>
            <Header range={range} dayPx={dayPx} actW={actW} />
            {teamAus.length > 0 && (
              <Row label="Ausencias del equipo" actW={actW} rowW={rowW} gridBg={gridBg} bands={bands} height={26}>
                {teamAus.map((a) => {
                  const per = personal.find((p) => p.id === a.persona_id);
                  const s = midnight(toDate(a.desde)!), e = midnight(toDate(a.hasta)!);
                  const sC = s < range.min ? range.min : s;
                  const eC = e > range.max ? range.max : e;
                  const off = daysBetween(range.min, sC);
                  const dur = Math.max(daysBetween(sC, eC) + 1, 1);
                  return (
                    <div key={a.id}
                      className="absolute top-1 bottom-1 rounded px-1 text-[9px] font-bold text-white overflow-hidden whitespace-nowrap"
                      style={{ left: off * dayPx, width: dur * dayPx, background: AUS_COLORS[keyOf(a.tipo)] || "#F76707" }}
                      title={`${per?.nombre} · ${a.tipo} · ${fmtDate(a.desde)} → ${fmtDate(a.hasta)}`}>
                      {per?.nombre.split(" ")[0]}
                    </div>
                  );
                })}
              </Row>
            )}
            {hitos.map((h) => {
              const md = toDate(h.fecha);
              if (!md) return null;
              const off = daysBetween(range.min, midnight(md));
              const cumplido = keyOf(h.estado) === "cumplido";
              return (
                <Row key={h.id} actW={actW} rowW={rowW} gridBg={gridBg} bands={bands} height={ROWH}
                  label={
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Flag className={cn("h-3.5 w-3.5 shrink-0", cumplido ? "text-[#2b8a3e]" : "text-[#e8590c]")} />
                      <button type="button" className="truncate text-left hover:underline" onClick={() => setEditHito(h)}>{h.hito}</button>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(h.fecha)}</span>
                      <button type="button" aria-label="Eliminar hito" className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => delHito.mutate(h.id)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  }>
                  <span className={cn("absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-base leading-none",
                    cumplido ? "text-[#2b8a3e]" : "text-[#e8590c]")}
                    style={{ left: off * dayPx + dayPx / 2 }} title={`${h.hito} · ${fmtDate(h.fecha)}`}>
                    ◆
                  </span>
                </Row>
              );
            })}
            {acts.map((a, idx) => (
              <ActRow key={a.id} a={a} idx={idx} acts={acts} range={range} dayPx={dayPx} actW={actW}
                gridBg={gridBg} bands={bands} drag={drag} etiquetas={etiquetas}
                comentarios={props.comentarios.filter((c) => c.actividad_id === a.id)}
                subtareas={props.subtareas.filter((s) => s.actividad_id === a.id)}
                onEdit={() => setEditAct(a)} onMoveRow={moveRow} onBarMouseDown={onBarMouseDown(a)} />
            ))}
            <DepSvg acts={acts} range={range} dayPx={dayPx} actW={actW}
              extraRows={(teamAus.length > 0 ? 1 : 0) + hitos.filter((h) => toDate(h.fecha)).length} />
          </div>
        </div>
      )}

      {editAct && (
        <ActividadModal actividad={editAct} proyectoId={proyecto.id} hermanas={acts}
          subtareas={props.subtareas.filter((s) => s.actividad_id === editAct.id)}
          comentarios={props.comentarios.filter((c) => c.actividad_id === editAct.id)}
          etiquetas={etiquetas} onClose={() => setEditAct(null)} />
      )}
      {editHito && (
        <HitoModal hito={editHito === "new" ? null : editHito} proyectoId={proyecto.id}
          onClose={() => setEditHito(null)} />
      )}
    </div>
  );
}