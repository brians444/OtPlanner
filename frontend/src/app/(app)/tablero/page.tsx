"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, Loader2, Plus, Printer, TrafficCone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { estadoColor } from "@/lib/colors";
import { keyOf } from "@/lib/format";
import { proyectoService } from "@/lib/services";
import type { Proyecto, Snapshot } from "@/lib/types";
import { KpiBar } from "@/components/board/kpi-bar";
import { FiltersBar } from "@/components/board/filters-bar";
import { ProjectCard } from "@/components/board/project-card";
import { WipModal, loadWip } from "@/components/board/wip-modal";
import { ProyectoFormModal } from "@/components/project/proyecto-form-modal";
import { ProjectModal } from "@/components/project/project-modal";

export default function TableroPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [wip, setWip] = useState<Record<string, number>>({});
  const [showWip, setShowWip] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    setWip(loadWip());
    setFiltersOpen(localStorage.getItem("kanbanFiltersOpen") !== "0");
  }, []);

  const filters = useBoardFilters(snap.proyectos, snap.actividades, snap.etiquetas);

  const estados = useMemo(() => {
    const fromList = snap.listas.filter((l) => l.catalog === "Estado").map((l) => l.value);
    const fromData = snap.proyectos.map((p) => p.estado).filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of [...fromList, ...fromData]) {
      if (!seen.has(keyOf(e))) { seen.add(keyOf(e)); out.push(e); }
    }
    return out.length ? out : ["Pendiente", "En progreso", "Testing", "Completado", "Cancelado"];
  }, [snap.listas, snap.proyectos]);

  const moveMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      proyectoService.setEstado(id, estado),
    onMutate: async ({ id, estado }) => {
      await qc.cancelQueries({ queryKey: ["snapshot"] });
      const prev = qc.getQueryData<Snapshot>(["snapshot"]);
      qc.setQueryData<Snapshot>(["snapshot"], (old) =>
        old ? {
          ...old,
          proyectos: old.proyectos.map((p) =>
            p.id === id ? { ...p, estado, avance: keyOf(estado) === "completado" ? 100 : p.avance } : p),
        } : old);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["snapshot"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
  });

  const onDrop = (estado: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const p = snap.proyectos.find((x) => x.id === id);
    if (p && keyOf(p.estado) !== keyOf(estado)) moveMutation.mutate({ id, estado });
  };

  const openProject = openId ? snap.proyectos.find((p) => p.id === openId) ?? null : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando tablero…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-bold">Tablero</h1>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setFiltersOpen((o) => {
                localStorage.setItem("kanbanFiltersOpen", o ? "0" : "1");
                return !o;
              });
            }}>
              <Filter className="mr-2 h-4 w-4" />
              Filtros{filters.totalSelected > 0 ? ` (${filters.totalSelected})` : ""}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWip(true)}>
              <TrafficCone className="mr-2 h-4 w-4" /> WIP
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo proyecto
            </Button>
          </div>
        </div>

        <KpiBar proyectos={filters.filtered} />

        {filtersOpen && (
          <div className="no-print rounded-lg border bg-card p-3">
            <FiltersBar
              proyectos={snap.proyectos} listas={snap.listas} etiquetas={snap.etiquetas}
              sel={filters.sel} setOne={filters.setOne}
              tagLogic={filters.tagLogic} setTagLogic={filters.setTagLogic}
              search={filters.search} setSearch={filters.setSearch}
              desde={filters.desde} setDesde={filters.setDesde}
              hasta={filters.hasta} setHasta={filters.setHasta}
              clearAll={filters.clearAll}
            />
          </div>
        )}

        <div className="print-area flex gap-3 overflow-x-auto pb-4 items-start">
          {estados.map((estado, i) => {
            const items = filters.filtered.filter((p) => keyOf(p.estado || "Pendiente") === keyOf(estado));
            const color = estadoColor(estado, i);
            const lim = wip[keyOf(estado)];
            const over = !!lim && items.length > lim;
            return (
              <div
                key={estado}
                className={cn("flex w-[290px] shrink-0 flex-col rounded-lg border bg-muted/40",
                  dragOver === estado && "ring-2 ring-primary")}
                onDragOver={(e) => { e.preventDefault(); setDragOver(estado); }}
                onDragLeave={() => setDragOver((d) => (d === estado ? null : d))}
                onDrop={onDrop(estado)}
              >
                <div className={cn("flex items-center justify-between rounded-t-lg px-3 py-2 text-white",
                  over && "animate-pulse ring-2 ring-inset ring-destructive")}
                  style={{ background: color }}>
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    {estado}
                    {lim ? (
                      <span className={cn("rounded-full px-1.5 text-[10px] font-extrabold",
                        over ? "bg-destructive" : "bg-black/25")} title={`Límite WIP: ${lim}`}>
                        {items.length}/{lim}
                      </span>
                    ) : null}
                  </span>
                  <span className="rounded-full bg-black/25 px-2 text-xs font-bold">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                  {items.map((p) => (
                    <ProjectCard
                      key={p.id} p={p}
                      etiquetas={snap.etiquetas} comentarios={snap.comentarios}
                      onOpen={() => setOpenId(p.id)}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">Sin proyectos</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <WipModal open={showWip} onClose={() => setShowWip(false)}
        estados={estados} wip={wip} onChange={setWip} />
      <ProyectoFormModal open={formOpen} onClose={() => setFormOpen(false)}
        proyecto={null} listas={snap.listas} etiquetas={snap.etiquetas} />
      {openProject && (
        <ProjectModal proyecto={openProject} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}