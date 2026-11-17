"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiError } from "@/lib/api";
import { actividadService } from "@/lib/services";
import { estadoFromPct } from "@/lib/format";
import { tagColor } from "@/lib/colors";
import { ChecklistPanel } from "./checklist-panel";
import { CommentsPanel } from "./comments-panel";
import type { Actividad, Comentario, Etiqueta, Subtarea } from "@/lib/types";

const NONE = "__none__";

interface Props {
  actividad: Actividad;
  proyectoId: string;
  hermanas: Actividad[];
  subtareas: Subtarea[];
  comentarios: Comentario[];
  etiquetas: Etiqueta[];
  onClose: () => void;
}

export function ActividadModal({ actividad, proyectoId, hermanas, subtareas, comentarios, etiquetas, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    actividad: actividad.actividad,
    fecha_inicio: actividad.fecha_inicio || "",
    fecha_fin: actividad.fecha_fin || "",
    avance: actividad.avance,
    etiqueta: actividad.etiqueta,
    depende_de: actividad.depende_de,
    peso: actividad.peso,
  });
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    setForm({
      actividad: actividad.actividad,
      fecha_inicio: actividad.fecha_inicio || "",
      fecha_fin: actividad.fecha_fin || "",
      avance: actividad.avance,
      etiqueta: actividad.etiqueta,
      depende_de: actividad.depende_de,
      peso: actividad.peso,
    });
  }, [actividad]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["snapshot"] });

  const save = useMutation({
    mutationFn: () => actividadService.update(actividad.id, {
      actividad: form.actividad,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      avance: form.avance,
      etiqueta: form.etiqueta,
      depende_de: form.depende_de,
      peso: form.peso,
    }),
    onSuccess: invalidate,
    onError: (e) => setError(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: () => actividadService.remove(actividad.id),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e) => setError(apiError(e)),
  });

  const otras = hermanas.filter((a) => a.id !== actividad.id);

  return (
    <Modal open onClose={onClose} title={`${actividad.id} · Actividad`} size="2xl" nested>
      <Tabs defaultValue="datos">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="checklist">Checklist ({subtareas.length})</TabsTrigger>
          <TabsTrigger value="comentarios">Comentarios ({comentarios.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-4 mt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Actividad *</Label>
              <Input value={form.actividad}
                onChange={(e) => setForm((f) => ({ ...f, actividad: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha inicio</Label>
              <Input type="date" value={form.fecha_inicio}
                onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha fin</Label>
              <Input type="date" value={form.fecha_fin}
                onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Avance: {form.avance}% · {estadoFromPct(form.avance)}</Label>
              <input type="range" min={0} max={100} value={form.avance}
                className="w-full accent-[hsl(var(--primary))]"
                onChange={(e) => setForm((f) => ({ ...f, avance: parseInt(e.target.value, 10) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Depende de</Label>
              <Select value={form.depende_de || NONE}
                onValueChange={(v) => setForm((f) => ({ ...f, depende_de: v === NONE ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="(ninguna)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(ninguna)</SelectItem>
                  {otras.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.id} · {a.actividad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Peso (ponderación)</Label>
              <Input type="number" min={0} step="0.5" value={form.peso}
                onChange={(e) => setForm((f) => ({ ...f, peso: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Etiqueta</Label>
              <Select value={form.etiqueta || NONE}
                onValueChange={(v) => setForm((f) => ({ ...f, etiqueta: v === NONE ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="(sin etiqueta)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>(sin etiqueta)</SelectItem>
                  {etiquetas.filter((t) => t.activa).map((t) => (
                    <SelectItem key={t.id} value={t.etiqueta}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tagColor(t.etiqueta, etiquetas) }} />
                        {t.etiqueta}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="flex justify-between">
            <Button variant="destructive" onClick={() => setConfirmDel(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button disabled={save.isPending || !form.actividad.trim()} onClick={() => save.mutate()}>
                {save.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-3">
          <ChecklistPanel kind="act" ownerId={actividad.id} items={subtareas} />
        </TabsContent>

        <TabsContent value="comentarios" className="mt-3">
          <CommentsPanel comentarios={comentarios} proyectoId={proyectoId} actividadId={actividad.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDel}
        title="Eliminar actividad"
        message={<>Se eliminará <b>{actividad.actividad}</b> con sus subtareas y comentarios. Las dependencias hacia ella se quitarán. ¿Continuar?</>}
        confirmLabel="Eliminar" destructive
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDel(false)}
      />
    </Modal>
  );
}