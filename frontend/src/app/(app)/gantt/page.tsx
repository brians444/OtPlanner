"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { AUS_COLORS, estadoColor } from "@/lib/colors";
import { daysBetween, fmtDate, isChecklistMode, keyOf, midnight, toDate } from "@/lib/format";
import { computeRange, loadWidths, saveWidths } from "@/components/project/gantt-shared";
import { Header, Row } from "@/components/project/gantt-parts";
import { ProjectModal } from "@/components/project/project-modal";
import type { Proyecto } from "@/lib/types";

const ALL = "__all__";
const ROWH = 39;

export default function GanttGlobalPage() {
  const { data, isLoading } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;
  const [dayPx, setDayPx] = useState(16);
  const [actW, setActW] = useState(230);
  const [estado, setEstado] = useState(ALL);
  const [resp, setResp] = useState(ALL);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const w = loadWidths();
    setDayPx(w.dayPx);
    setActW(w.actW);
  }, []);

  const setWidths = (d: number, a: number) => {
    setDayPx(d);
    setActW(a);
    saveWidths(d, a);
  };

  const proyectos = useMemo(() => {
    return snap.proyectos
      .filter((p) => !isChecklistMode(p.modo_tareas) && (p.fecha_inicio || p.fecha_fin_estimada))
      .filter((p) => estado === ALL || keyOf(p.estado) === keyOf(estado))
      .filter((p) => resp === ALL || keyOf(p.responsable) === keyOf(resp))
      .filter((p) => !search || keyOf(p.proyecto + " " + p.id + " " + p.responsable).includes(keyOf(search)))
      .sort((a, b) => (a.fecha_inicio || "9999").localeCompare(b.fecha_inicio || "9999"));
  }, [snap.proyectos, estado, resp, search]);

  const range = useMemo(() => computeRange(
    proyectos.map((p) => p.fecha_inicio),
    proyectos.map((p) => p.fecha_fin_estimada),
  ), [proyectos]);

  const estadosList = useMemo(() =>
    [...new Set(snap.proyectos.map((p) => p.estado).filter(Boolean))], [snap.proyectos]);
  const respList = useMemo(() =>
    [...new Set(snap.proyectos.map((p) => p.responsable).filter(Boolean))].sort(), [snap.proyectos]);

  const rowW = range.totalDays * dayPx;
  const gridBg: React.CSSProperties = {
    backgroundImage: "linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px)",
    backgroundSize: `${dayPx}px 100%`,
  };
  const bands = (
    <>
      {range.weekendOffsets.map((i) => (
        <div key={i} className="absolute inset-y-0 bg-muted/60" style={{ left: i * dayPx, width: dayPx }} />
      ))}
      {range.todayOffset >= 0 && (
        <div className="absolute inset-y-0 w-[2px] bg-[#e8590c] z-[2]" style={{ left: range.todayOffset * dayPx }} />
      )}
    </>
  );

  const ausencias = useMemo(() => {
    const names = new Map(snap.personal.map((p) => [p.id, p.nombre]));
    return snap.ausencias
      .filter((a) => keyOf(a.tipo) !== "franco generado")
      .map((a) => ({ ...a, nombre: names.get(a.persona_id) || "?" }));
  }, [snap.ausencias, snap.personal]);

  const openProject = openId ? snap.proyectos.find((p) => p.id === openId) ?? null : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando Gantt…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Gantt global</h1>
            <p className="text-sm text-muted-foreground">{proyectos.length} proyectos con fechas · línea naranja = hoy</p>
          </div>
          <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />Imprimir
          </Button>
        </div>

        <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input className="h-8 w-48" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Proyecto, ID, responsable…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {estadosList.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsable</Label>
            <Select value={resp} onValueChange={setResp}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {respList.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Zoom: {dayPx}px/día</Label>
            <input type="range" min={6} max={60} value={dayPx} className="w-36 accent-[hsl(var(--primary))]"
              onChange={(e) => setWidths(parseInt(e.target.value, 10), actW)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Columna: {actW}px</Label>
            <input type="range" min={120} max={600} step={10} value={actW} className="w-36 accent-[hsl(var(--primary))]"
              onChange={(e) => setWidths(dayPx, parseInt(e.target.value, 10))} />
          </div>
        </div>

        {proyectos.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No hay proyectos con fechas para los filtros seleccionados.</p>
        ) : (
          <div className="print-area overflow-x-auto rounded-lg border bg-card">
            <div className="relative" style={{ width: actW + rowW }}>
              <Header range={range} dayPx={dayPx} actW={actW} />
              {proyectos.map((p, i) => {
                const s = toDate(p.fecha_inicio);
                const e = toDate(p.fecha_fin_estimada);
                const off = s ? daysBetween(range.min, midnight(s)) : e ? daysBetween(range.min, midnight(e)) : 0;
                const dur = s && e ? Math.max(daysBetween(midnight(s), midnight(e)) + 1, 1) : 1;
                const color = estadoColor(p.estado, i);
                const phitos = snap.hitos.filter((h) => h.proyecto_id === p.id && h.fecha);
                return (
                  <Row key={p.id} actW={actW} rowW={rowW} gridBg={gridBg} bands={bands} height={ROWH}
                    label={
                      <button type="button" onClick={() => setOpenId(p.id)} className="min-w-0 text-left hover:underline">
                        <span className="block truncate text-xs font-semibold" title={p.proyecto}>{p.proyecto}</span>
                        <span className="block truncate text-[9px] text-muted-foreground">
                          {p.id} · {p.responsable || "—"} · {p.estado}
                        </span>
                      </button>
                    }>
                    {(s || e) && (
                      <div
                        className="absolute rounded overflow-hidden border border-black/10 shadow-sm cursor-pointer"
                        style={{ left: off * dayPx, width: dur * dayPx, top: 9, height: ROWH - 18, background: color }}
                        title={`${p.proyecto} · ${p.avance}% · ${fmtDate(p.fecha_inicio)} → ${fmtDate(p.fecha_fin_estimada)}`}
                        onClick={() => setOpenId(p.id)}
                      >
                        <div className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${p.avance}%` }} />
                        {dur * dayPx > 30 && (
                          <span className="relative z-[1] px-1 text-[9px] font-bold text-white leading-[21px]">{p.avance}%</span>
                        )}
                      </div>
                    )}
                    {phitos.map((h) => {
                      const d = toDate(h.fecha)!;
                      const o = daysBetween(range.min, midnight(d));
                      if (o < 0 || o >= range.totalDays) return null;
                      return (
                        <span key={h.id}
                          className={cn("absolute z-[2] text-[13px] leading-none",
                            keyOf(h.estado) === "cumplido" ? "text-green-600" : "text-[#e8590c]")}
                          style={{ left: o * dayPx + dayPx / 2 - 6, top: ROWH / 2 - 7 }}
                          title={`◆ ${h.hito} · ${fmtDate(h.fecha)} · ${h.estado}`}>◆</span>
                      );
                    })}
                  </Row>
                );
              })}
              {ausencias.length > 0 && (
                <Row actW={actW} rowW={rowW} gridBg={gridBg} bands={bands} height={ROWH}
                  label={<span className="text-xs font-semibold text-muted-foreground">Ausencias del equipo</span>}>
                  {ausencias.map((a) => {
                    const s = toDate(a.desde), e = toDate(a.hasta);
                    if (!s || !e) return null;
                    const off = daysBetween(range.min, midnight(s));
                    const dur = Math.max(daysBetween(midnight(s), midnight(e)) + 1, 1);
                    if (off + dur <= 0 || off >= range.totalDays) return null;
                    const left = Math.max(off, 0) * dayPx;
                    const width = (Math.min(off + dur, range.totalDays) - Math.max(off, 0)) * dayPx;
                    return (
                      <div key={a.id} className="absolute rounded-sm opacity-80"
                        style={{ left, width, top: 12, height: ROWH - 24, background: AUS_COLORS[keyOf(a.tipo)] || "#868e96" }}
                        title={`${a.nombre} · ${a.tipo} · ${fmtDate(a.desde)} → ${fmtDate(a.hasta)}`} />
                    );
                  })}
                </Row>
              )}
            </div>
          </div>
        )}
      </div>
      {openProject && <ProjectModal proyecto={openProject} onClose={() => setOpenId(null)} />}
    </div>
  );
}