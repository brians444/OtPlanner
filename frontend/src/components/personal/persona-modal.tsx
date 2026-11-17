"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiError } from "@/lib/api";
import { personalService } from "@/lib/services";
import type { Persona } from "@/lib/types";

interface Props { persona: Persona | null; onClose: () => void }

export function PersonaModal({ persona, onClose }: Props) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    nombre: persona?.nombre || "",
    puesto: persona?.puesto || "",
    area: persona?.area || "",
    legajo: persona?.legajo || "",
    base: persona?.base || "",
    francos_generados: String(persona?.francos_generados ?? 0),
    notas: persona?.notas || "",
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre: f.nombre.trim(), puesto: f.puesto, area: f.area, legajo: f.legajo,
        base: f.base, francos_generados: Math.max(0, parseInt(f.francos_generados, 10) || 0), notas: f.notas,
      };
      return persona ? personalService.update(persona.id, payload) : personalService.create(f.nombre.trim())
        .then((p) => personalService.update(p.id, payload));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["snapshot"] }); onClose(); },
    onError: (e) => setError(apiError(e)),
  });

  return (
    <Modal open onClose={onClose} title={persona ? "Editar persona" : "Nueva persona"} size="lg" nested>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.nombre.trim()) save.mutate(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nombre *</Label>
            <Input value={f.nombre} onChange={set("nombre")} required autoFocus />
          </div>
          <div className="space-y-1.5"><Label>Puesto</Label><Input value={f.puesto} onChange={set("puesto")} /></div>
          <div className="space-y-1.5"><Label>Área</Label><Input value={f.area} onChange={set("area")} /></div>
          <div className="space-y-1.5"><Label>Legajo</Label><Input value={f.legajo} onChange={set("legajo")} /></div>
          <div className="space-y-1.5"><Label>Base</Label><Input value={f.base} onChange={set("base")} /></div>
          <div className="space-y-1.5">
            <Label>Francos generados (manual)</Label>
            <Input type="number" min={0} value={f.francos_generados} onChange={set("francos_generados")} />
            <p className="text-[11px] text-muted-foreground">Se suman a los días de ausencias tipo &quot;Franco Generado&quot;.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={f.notas} onChange={set("notas")} />
          </div>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}