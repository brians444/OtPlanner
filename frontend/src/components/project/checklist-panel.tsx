"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CheckCheck, ListChecks, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEM_COLORS } from "@/lib/colors";
import { keyOf } from "@/lib/format";
import { apiError } from "@/lib/api";
import { actividadService, checklistService, subtareaService } from "@/lib/services";
import type { ChecklistItem, Subtarea } from "@/lib/types";

const DEMANDAS = ["Alta", "Media", "Baja"];

interface Props {
  kind: "proy" | "act";
  ownerId: string;
  items: (ChecklistItem | Subtarea)[];
}

export function ChecklistPanel({ kind, ownerId, items }: Props) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [horas, setHoras] = useState("");
  const [demanda, setDemanda] = useState("Media");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["snapshot"] });
  const onError = (e: unknown) => setError(apiError(e));

  const sorted = [...items].sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));
  const done = sorted.filter((i) => i.hecha).length;
  const pct = sorted.length ? Math.round((done / sorted.length) * 100) : 0;
  const horasTotal = sorted.reduce((s, i) => s + (i.horas_est || 0), 0);
  const horasDone = sorted.filter((i) => i.hecha).reduce((s, i) => s + (i.horas_est || 0), 0);
  const porDemanda = DEMANDAS.map((d) => ({
    d, n: sorted.filter((i) => keyOf(i.demanda) === keyOf(d)).length,
  })).filter((x) => x.n > 0);

  const create = useMutation({
    mutationFn: () => {
      const payload = {
        texto: texto.trim(),
        horas_est: horas ? parseFloat(horas.replace(",", ".")) : null,
        demanda,
      };
      return kind === "proy"
        ? checklistService.create({ proyecto_id: ownerId, ...payload })
        : subtareaService.create({ actividad_id: ownerId, ...payload });
    },
    onSuccess: () => { setTexto(""); setHoras(""); invalidate(); },
    onError,
  });

  const toggle = useMutation({
    mutationFn: ({ id, hecha }: { id: string; hecha: boolean }) =>
      kind === "proy" ? checklistService.update(id, { hecha }) : subtareaService.update(id, { hecha }),
    onSuccess: invalidate, onError,
  });

  const saveText = useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) =>
      kind === "proy" ? checklistService.update(id, { texto }) : subtareaService.update(id, { texto }),
    onSuccess: () => { setEditing(null); invalidate(); },
    onError,
  });

  const setDem = useMutation({
    mutationFn: ({ id, demanda }: { id: string; demanda: string }) =>
      kind === "proy" ? checklistService.update(id, { demanda }) : subtareaService.update(id, { demanda }),
    onSuccess: invalidate, onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      kind === "proy" ? checklistService.remove(id) : subtareaService.remove(id),
    onSuccess: invalidate, onError,
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      kind === "proy" ? checklistService.reorder(ids) : subtareaService.reorder(ids),
    onSuccess: invalidate, onError,
  });

  const markDone = useMutation({
    mutationFn: (done: boolean) => actividadService.done(ownerId, done),
    onSuccess: invalidate, onError,
  });

  const applyPct = useMutation({
    mutationFn: () => actividadService.applyChecklist(ownerId),
    onSuccess: invalidate, onError,
  });

  const move = (idx: number, dir: -1 | 1) => {
    const ids = sorted.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ListChecks className="h-4 w-4 text-primary" />
          {done}/{sorted.length} ítems
        </span>
        <Progress value={pct} className="h-2 w-32" />
        <b>{pct}%</b>
        {horasTotal > 0 && (
          <span className="text-muted-foreground">
            {horasDone}/{horasTotal} h estimadas
          </span>
        )}
        {porDemanda.map(({ d, n }) => (
          <span key={d} className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
            style={{ background: DEM_COLORS[keyOf(d)] }}>
            {d}: {n}
          </span>
        ))}
        {kind === "act" && sorted.length > 0 && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => applyPct.mutate()}
            disabled={applyPct.isPending}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Aplicar % al avance
          </Button>
        )}
      </div>

      {kind === "act" && sorted.length === 0 && (
        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent">
          <Checkbox
            checked={false}
            onCheckedChange={(v) => markDone.mutate(!!v)}
          />
          Marcar la actividad como completada (sin checklist)
        </label>
      )}

      <div className="flex flex-col gap-1.5 max-h-[45vh] overflow-y-auto pr-1">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todavía no hay ítems. Agregá el primero abajo.
          </p>
        )}
        {sorted.map((item, idx) => (
          <div key={item.id} className={cn("group flex items-center gap-2 rounded-md border px-2.5 py-1.5",
            item.hecha && "bg-muted/40")}>
            <Checkbox checked={item.hecha}
              onCheckedChange={(v) => toggle.mutate({ id: item.id, hecha: !!v })} />
            {editing === item.id ? (
              <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="h-7 flex-1 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editText.trim()) saveText.mutate({ id: item.id, texto: editText.trim() });
                  if (e.key === "Escape") setEditing(null);
                }}
                onBlur={() => {
                  if (editText.trim() && editText !== item.texto) saveText.mutate({ id: item.id, texto: editText.trim() });
                  else setEditing(null);
                }} />
            ) : (
              <button type="button" className={cn("flex-1 text-left text-sm", item.hecha && "line-through text-muted-foreground")}
                onClick={() => { setEditing(item.id); setEditText(item.texto); }}>
                {item.texto}
              </button>
            )}
            {item.horas_est ? (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                {item.horas_est}h
              </span>
            ) : null}
            <Select value={item.demanda || "Media"}
              onValueChange={(v) => setDem.mutate({ id: item.id, demanda: v })}>
              <SelectTrigger className="h-7 w-[86px] text-xs border-0 text-white"
                style={{ background: DEM_COLORS[keyOf(item.demanda)] || DEM_COLORS.media }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEMANDAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" aria-label="Subir" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === 0} onClick={() => move(idx, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Bajar" className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === sorted.length - 1} onClick={() => move(idx, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Eliminar" className="p-1 text-muted-foreground hover:text-destructive"
                onClick={() => remove.mutate(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nuevo ítem…"
          className="flex-1 min-w-[180px] h-9"
          onKeyDown={(e) => { if (e.key === "Enter" && texto.trim()) create.mutate(); }} />
        <Input value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Horas"
          type="number" min={0} step="0.5" className="w-20 h-9" />
        <Select value={demanda} onValueChange={setDemanda}>
          <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEMANDAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!texto.trim() || create.isPending} onClick={() => create.mutate()}>
          <Plus className="mr-1.5 h-4 w-4" /> Agregar
        </Button>
      </div>
    </div>
  );
}