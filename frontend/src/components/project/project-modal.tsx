"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, History, ListChecks, MessageSquare, Pencil, StickyNote, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/modal";
import { cn } from "@/lib/utils";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { PRIO_COLORS, tagColor } from "@/lib/colors";
import { fmtDate, isChecklistMode, keyOf } from "@/lib/format";
import { proyectoService } from "@/lib/services";
import { tagsOf, type Proyecto } from "@/lib/types";
import { GanttPanel } from "./gantt-panel";
import { ChecklistPanel } from "./checklist-panel";
import { CommentsPanel } from "./comments-panel";
import { NotesPanel } from "./notes-panel";
import { HistoryPanel } from "./history-panel";
import { ProyectoFormModal } from "./proyecto-form-modal";

interface Props {
  proyecto: Proyecto;
  onClose: () => void;
}

export function ProjectModal({ proyecto, onClose }: Props) {
  const qc = useQueryClient();
  const { data } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;
  const [mounted, setMounted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [dupMsg, setDupMsg] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const acts = useMemo(() =>
    snap.actividades.filter((a) => a.proyecto_id === proyecto.id).sort((a, b) => a.orden - b.orden),
    [snap.actividades, proyecto.id]);
  const subs = snap.subtareas.filter((s) => s.proyecto_id === proyecto.id);
  const coms = snap.comentarios.filter((c) => c.proyecto_id === proyecto.id);
  const checklist = snap.checklist.filter((c) => c.proyecto_id === proyecto.id).sort((a, b) => a.orden - b.orden);
  const hitos = snap.hitos.filter((h) => h.proyecto_id === proyecto.id);
  const hist = snap.historial.filter((h) => h.proyecto_id === proyecto.id);
  const chat = coms.filter((c) => !c.actividad_id);

  const estados = useMemo(() => {
    const vals = snap.listas.filter((l) => l.catalog === "Estado").map((l) => l.value);
    if (!vals.some((v) => keyOf(v) === keyOf(proyecto.estado))) vals.unshift(proyecto.estado);
    return vals.length ? vals : [proyecto.estado];
  }, [snap.listas, proyecto.estado]);

  const setEstado = useMutation({
    mutationFn: (estado: string) => proyectoService.setEstado(proyecto.id, estado),
    onSettled: () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
  });
  const duplicate = useMutation({
    mutationFn: () => proyectoService.duplicate(proyecto.id),
    onSuccess: (copy) => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      setDupMsg(`Duplicado como ${copy.id}`);
      setTimeout(() => setDupMsg(""), 3000);
    },
  });
  const remove = useMutation({
    mutationFn: () => proyectoService.remove(proyecto.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      setConfirmDel(false);
      onClose();
    },
  });

  const checklistMode = isChecklistMode(proyecto.modo_tareas);
  const prioColor = PRIO_COLORS[keyOf(proyecto.prioridad)] || "#e8590c";
  const tags = tagsOf(proyecto);

  if (!mounted) return null;

  const content = (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-[94vh] w-full max-w-[1500px] flex-col rounded-lg bg-background shadow-xl border">
        <div className="border-b px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{proyecto.id}</span>
                <h2 className="text-lg font-bold truncate">{proyecto.proyecto}</h2>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: prioColor }}>
                  {proyecto.prioridad || "Media"}
                </span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {checklistMode ? "Checklist" : "Gantt"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Resp: <b className="text-foreground">{proyecto.responsable || "—"}</b></span>
                {proyecto.responsable_tecnico && <span>RT: {proyecto.responsable_tecnico}</span>}
                {proyecto.project_leader && <span>PL: {proyecto.project_leader}</span>}
                {!checklistMode && <span>{fmtDate(proyecto.fecha_inicio)} → {fmtDate(proyecto.fecha_fin_estimada)}</span>}
                {proyecto.sprint && <span>Sprint: {proyecto.sprint}</span>}
                {proyecto.fase && <span>Fase: {proyecto.fase}</span>}
                {tags.map((t) => (
                  <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ background: tagColor(t, snap.etiquetas) }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="no-print flex shrink-0 items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />Duplicar
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDel(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-44 shrink-0">
              <Select value={proyecto.estado} onValueChange={(v) => setEstado.mutate(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <Progress value={proyecto.avance} className="h-2.5" />
              <span className="text-sm font-bold tabular-nums w-11 text-right">{proyecto.avance}%</span>
            </div>
            {dupMsg && <span className="text-xs font-medium text-green-600">{dupMsg}</span>}
          </div>
        </div>

        <Tabs defaultValue="tareas" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="no-print mx-4 mt-3 w-fit">
            <TabsTrigger value="tareas" className="gap-1.5">
              <ListChecks className="h-4 w-4" />{checklistMode ? "Checklist" : "Gantt"}
            </TabsTrigger>
            <TabsTrigger value="notas" className="gap-1.5">
              <StickyNote className="h-4 w-4" />Notas y chat
              {chat.length > 0 && <span className="rounded-full bg-muted px-1.5 text-[10px]">{chat.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-1.5">
              <History className="h-4 w-4" />Historial
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tareas" className={cn("min-h-0 flex-1 overflow-auto px-4 pb-4 mt-3")}>
            {checklistMode ? (
              <ChecklistPanel kind="proy" ownerId={proyecto.id} items={checklist} />
            ) : (
              <GanttPanel proyecto={proyecto} actividades={acts} subtareas={subs}
                comentarios={coms} hitos={hitos} etiquetas={snap.etiquetas}
                personal={snap.personal} ausencias={snap.ausencias} />
            )}
          </TabsContent>
          <TabsContent value="notas" className="min-h-0 flex-1 overflow-auto px-4 pb-4 mt-3">
            <div className="grid gap-6 lg:grid-cols-2">
              <NotesPanel key={proyecto.id + proyecto.ultima_actualizacion} proyecto={proyecto} />
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4" />Chat del proyecto
                </h3>
                <CommentsPanel comentarios={chat} proyectoId={proyecto.id}
                  emptyText="Sin mensajes. Escribí el primero para el equipo." />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="historial" className="min-h-0 flex-1 overflow-auto px-4 pb-4 mt-3">
            <HistoryPanel entries={hist} proyectoId={proyecto.id} />
          </TabsContent>
        </Tabs>
      </div>

      <ProyectoFormModal open={editOpen} onClose={() => setEditOpen(false)}
        proyecto={proyecto} listas={snap.listas} etiquetas={snap.etiquetas} />
      <ConfirmDialog open={confirmDel} title="Eliminar proyecto"
        message={<>Se eliminará <b>{proyecto.proyecto}</b> ({proyecto.id}) con sus actividades, comentarios, checklist e hitos. Esta acción no se puede deshacer.</>}
        confirmLabel="Eliminar" destructive
        onConfirm={() => remove.mutate()} onCancel={() => setConfirmDel(false)} />
    </div>
  );

  return createPortal(content, document.body);
}