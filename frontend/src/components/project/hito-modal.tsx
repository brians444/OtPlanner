"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiError } from "@/lib/api";
import { hitoService } from "@/lib/services";
import { isoDate } from "@/lib/format";
import type { Hito } from "@/lib/types";

interface Props {
  hito: Hito | null;
  proyectoId: string;
  onClose: () => void;
}

export function HitoModal({ hito, proyectoId, onClose }: Props) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(hito?.hito || "");
  const [fecha, setFecha] = useState(hito?.fecha || isoDate(new Date()));
  const [estado, setEstado] = useState(hito?.estado || "Pendiente");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => hito
      ? hitoService.update(hito.id, { hito: nombre.trim(), fecha, estado })
      : hitoService.create({ proyecto_id: proyectoId, hito: nombre.trim(), fecha, estado }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      onClose();
    },
    onError: (e) => setError(apiError(e)),
  });

  return (
    <Modal open onClose={onClose} title={hito ? "Editar hito" : "Nuevo hito"} size="md" nested>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) save.mutate(); }}>
        <div className="space-y-1.5">
          <Label>Hito *</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha *</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pendiente">Pendiente</SelectItem>
              <SelectItem value="Cumplido">Cumplido</SelectItem>
            </SelectContent>
          </Select>
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