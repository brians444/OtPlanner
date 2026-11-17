"use client";

import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { PALETTE, PRIO_COLORS, estadoColor, riskInfo } from "@/lib/colors";
import { fmtDate, keyOf } from "@/lib/format";
import { KpiBar } from "@/components/board/kpi-bar";
import { ProjectModal } from "@/components/project/project-modal";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

export default function DashboardPage() {
  const { data, isLoading } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;
  const [openId, setOpenId] = useState<string | null>(null);

  const byEstado = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of snap.proyectos) {
      const e = p.estado || "Pendiente";
      map.set(e, (map.get(e) || 0) + 1);
    }
    return [...map.entries()].map(([name, value], i) => ({
      name, value, color: estadoColor(name, i),
    }));
  }, [snap.proyectos]);

  const byPrio = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of snap.proyectos) {
      const e = p.prioridad || "Media";
      map.set(e, (map.get(e) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({
      name, value, color: PRIO_COLORS[keyOf(name)] || "#868e96",
    }));
  }, [snap.proyectos]);

  const byResp = useMemo(() => {
    const map = new Map<string, { total: number; avance: number }>();
    for (const p of snap.proyectos) {
      const r = p.responsable || "Sin asignar";
      const cur = map.get(r) || { total: 0, avance: 0 };
      cur.total++;
      cur.avance += p.avance;
      map.set(r, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, proyectos: v.total, avance: Math.round(v.avance / v.total) }))
      .sort((a, b) => b.proyectos - a.proyectos)
      .slice(0, 8);
  }, [snap.proyectos]);

  const byArea = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of snap.proyectos) {
      const a = p.area || "Sin área";
      map.set(a, (map.get(a) || 0) + 1);
    }
    return [...map.entries()].map(([name, value], i) => ({
      name, value, color: PALETTE[i % PALETTE.length],
    })).sort((a, b) => b.value - a.value);
  }, [snap.proyectos]);

  const riesgos = useMemo(() =>
    snap.proyectos
      .map((p) => ({ p, risk: riskInfo(p.fecha_fin_estimada, p.estado, p.avance) }))
      .filter((x) => x.risk.cls)
      .sort((a, b) => (a.p.fecha_fin_estimada || "").localeCompare(b.p.fecha_fin_estimada || "")),
    [snap.proyectos]);

  const horasChecklist = useMemo(() => {
    const total = snap.checklist.reduce((s, c) => s + (c.horas_est || 0), 0);
    const hechas = snap.checklist.filter((c) => c.hecha).reduce((s, c) => s + (c.horas_est || 0), 0);
    return { total, hechas };
  }, [snap.checklist]);

  const openProject = openId ? snap.proyectos.find((p) => p.id === openId) ?? null : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando dashboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 space-y-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <KpiBar proyectos={snap.proyectos} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Proyectos por estado</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byEstado} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={44} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="value" name="Proyectos" radius={[4, 4, 0, 0]}>
                    {byEstado.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Prioridad</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byPrio} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}
                    paddingAngle={3} label={(e) => `${e.name}: ${e.value}`}>
                    {byPrio.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Carga por responsable (top 8)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byResp} layout="vertical" margin={{ top: 4, right: 24, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="proyectos" name="Proyectos" fill="#2C7BE5" radius={[0, 4, 4, 0]}
                    label={{ position: "right", fontSize: 10 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Proyectos por área</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byArea} dataKey="value" nameKey="name" outerRadius={90}
                    label={(e) => `${e.name}: ${e.value}`}>
                    {byArea.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#e8590c]" />
                Vencidos y por vencer ({riesgos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {riesgos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin proyectos en riesgo.</p>
              ) : (
                <div className="divide-y max-h-80 overflow-y-auto">
                  {riesgos.map(({ p, risk }) => (
                    <button key={p.id} type="button" onClick={() => setOpenId(p.id)}
                      className="flex w-full items-center gap-3 py-2 text-left hover:bg-muted/50 rounded px-1">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${risk.cls === "venc" ? "bg-destructive" : "bg-[#e8590c]"}`}>
                        {risk.lbl}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.proyecto}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.id} · {p.responsable || "—"} · fin {fmtDate(p.fecha_fin_estimada)}
                        </span>
                      </span>
                      <span className="w-24 shrink-0"><Progress value={p.avance} className="h-2" /></span>
                      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums">{p.avance}%</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Checklist unificado · horas estimadas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-3xl font-bold tabular-nums">{horasChecklist.total.toFixed(1)}h</p>
                  <p className="text-xs text-muted-foreground">estimadas en total</p>
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums text-green-600">{horasChecklist.hechas.toFixed(1)}h</p>
                  <p className="text-xs text-muted-foreground">completadas</p>
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums text-[#e8590c]">{(horasChecklist.total - horasChecklist.hechas).toFixed(1)}h</p>
                  <p className="text-xs text-muted-foreground">pendientes</p>
                </div>
              </div>
              <Progress value={horasChecklist.total ? (horasChecklist.hechas / horasChecklist.total) * 100 : 0} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {snap.checklist.length} ítems de checklist en {new Set(snap.checklist.map((c) => c.proyecto_id)).size} proyectos ·{" "}
                {snap.subtareas.length} subtareas en actividades
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      {openProject && <ProjectModal proyecto={openProject} onClose={() => setOpenId(null)} />}
    </div>
  );
}