"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiError } from "@/lib/api";
import { proyectoService } from "@/lib/services";
import { keyOf, norm } from "@/lib/format";
import { tagColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { tagsOf, type Etiqueta, type ListaValor, type Proyecto } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  proyecto: Proyecto | null;
  listas: ListaValor[];
  etiquetas: Etiqueta[];
}

const NONE = "__none__";

function optionsFor(listas: ListaValor[], catalog: string, current: string) {
  const vals = listas.filter((l) => l.catalog === catalog).map((l) => l.value);
  if (current && !vals.some((v) => keyOf(v) === keyOf(current))) vals.unshift(current);
  return vals;
}

export function ProyectoFormModal({ open, onClose, proyecto, listas, etiquetas }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    proyecto: "", descripcion: "", responsable: "", responsable_tecnico: "",
    project_leader: "", area: "", yacimiento: "", instalacion: "",
    estado: "Pendiente", prioridad: "Media", fecha_inicio: "", fecha_fin_estimada: "",
    sprint: "", fase: "", comentarios: "", modo_tareas: "Gantt",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (proyecto) {
      setForm({
        proyecto: proyecto.proyecto, descripcion: proyecto.descripcion,
        responsable: proyecto.responsable, responsable_tecnico: proyecto.responsable_tecnico,
        project_leader: proyecto.project_leader, area: proyecto.area,
        yacimiento: proyecto.yacimiento, instalacion: proyecto.instalacion,
        estado: proyecto.estado, prioridad: proyecto.prioridad,
        fecha_inicio: proyecto.fecha_inicio || "", fecha_fin_estimada: proyecto.fecha_fin_estimada || "",
        sprint: proyecto.sprint, fase: proyecto.fase, comentarios: proyecto.comentarios,
        modo_tareas: proyecto.modo_tareas || "Gantt",
      });
      setTags(tagsOf(proyecto));
    } else {
      setForm({
        proyecto: "", descripcion: "", responsable: "", responsable_tecnico: "",
        project_leader: "", area: "", yacimiento: "", instalacion: "",
        estado: "Pendiente", prioridad: "Media", fecha_inicio: "", fecha_fin_estimada: "",
        sprint: "", fase: "", comentarios: "", modo_tareas: "Gantt",
      });
      setTags([]);
    }
  }, [open, proyecto]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin_estimada: form.fecha_fin_estimada || null,
        etiquetas: tags,
      };
      if (proyecto) return proyectoService.update(proyecto.id, payload);
      return proyectoService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      onClose();
    },
    onError: (e) => setError(apiError(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectFor = (label: string, catalog: string, key: keyof typeof form, required = false) => {
    const opts = optionsFor(listas, catalog, form[key]);
    return (
      <div className="space-y-1.5">
        <Label>{label}{required && " *"}</Label>
        <Select value={form[key] || NONE} onValueChange={(v) => setForm((f) => ({ ...f, [key]: v === NONE ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="(sin definir)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(sin definir)</SelectItem>
            {opts.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const toggleTag = (t: string) => {
    setTags((cur) => {
      if (cur.some((x) => keyOf(x) === keyOf(t))) return cur.filter((x) => keyOf(x) !== keyOf(t));
      if (cur.length >= 5) return cur;
      return [...cur, t];
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!norm(form.proyecto) || !norm(form.responsable)) {
      setError("Nombre y responsable son obligatorios");
      return;
    }
    mutation.mutate();
  };

  const isChecklist = keyOf(form.modo_tareas) === "checklist";

  return (
    <Modal open={open} onClose={onClose} title={proyecto ? `Editar ${proyecto.id}` : "Nuevo proyecto"} size="2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Proyecto *</Label>
            <Input value={form.proyecto} onChange={set("proyecto")} required maxLength={300} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea value={form.descripcion} onChange={set("descripcion")} rows={2} />
          </div>
          {selectFor("Responsable", "Responsable", "responsable", true)}
          {selectFor("Resp. Técnico", "Responsable_Tecnico", "responsable_tecnico")}
          {selectFor("Project Leader", "Project_Leader", "project_leader")}
          {selectFor("Área", "Area", "area")}
          {selectFor("Yacimiento", "Yacimiento", "yacimiento")}
          {selectFor("Instalación", "Instalacion", "instalacion")}
          {selectFor("Estado", "Estado", "estado")}
          {selectFor("Prioridad", "Prioridad", "prioridad")}
          {selectFor("Sprint", "Sprint", "sprint")}
          {selectFor("Fase", "Fase", "fase")}
          <div className="space-y-1.5">
            <Label>Modo de tareas</Label>
            <Select value={form.modo_tareas} onValueChange={(v) => setForm((f) => ({ ...f, modo_tareas: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Gantt">Gantt (actividades con fechas)</SelectItem>
                <SelectItem value="Checklist">Checklist (ítems simples)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isChecklist && (
            <>
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Input type="date" value={form.fecha_inicio} onChange={set("fecha_inicio")} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin estimada</Label>
                <Input type="date" value={form.fecha_fin_estimada} onChange={set("fecha_fin_estimada")} />
              </div>
            </>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Etiquetas (máx. 5)</Label>
          <div className="flex flex-wrap gap-1.5 rounded-md border p-2 max-h-28 overflow-y-auto">
            {etiquetas.filter((t) => t.activa).map((t) => {
              const active = tags.some((x) => keyOf(x) === keyOf(t.etiqueta));
              return (
                <button key={t.id} type="button" onClick={() => toggleTag(t.etiqueta)}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-all border",
                    active ? "text-white border-transparent" : "border-border hover:bg-accent")}
                  style={active ? { background: tagColor(t.etiqueta, etiquetas) } : undefined}>
                  {t.etiqueta}
                </button>
              );
            })}
            {etiquetas.length === 0 && <span className="text-xs text-muted-foreground">No hay etiquetas creadas</span>}
          </div>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}