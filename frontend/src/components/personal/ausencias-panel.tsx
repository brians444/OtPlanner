"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUS_COLORS } from "@/lib/colors";
import { apiError } from "@/lib/api";
import { daysBetween, fmtDate, isoDate, keyOf, toDate } from "@/lib/format";
import { ausenciaService } from "@/lib/services";
import { AUS_TIPOS, type Ausencia, type Persona } from "@/lib/types";

export function francosDe(p: Persona, ausencias: Ausencia[]) {
  const mine = ausencias.filter((a) => a.persona_id === p.id);
  const dias = (a: Ausencia) => {
    const s = toDate(a.desde), e = toDate(a.hasta);
    return s && e ? Math.max(daysBetween(s, e) + 1, 1) : 0;
  };
  const usados = mine.filter((a) => keyOf(a.tipo) === "franco").reduce((s, a) => s + dias(a), 0);
  const genAuto = mine.filter((a) => keyOf(a.tipo) === "franco generado").reduce((s, a) => s + dias(a), 0);
  const generados = (p.francos_generados || 0) + genAuto;
  return { usados, genAuto, generados, restantes: generados - usados };
}

export function AusenciasPanel({ persona, ausencias }: { persona: Persona; ausencias: Ausencia[] }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("Vacaciones");
  const [desde, setDesde] = useState(isoDate(new Date()));
  const [hasta, setHasta] = useState(isoDate(new Date()));
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");

  const mine = useMemo(() =>
    ausencias.filter((a) => a.persona_id === persona.id)
      .sort((a, b) => b.desde.localeCompare(a.desde)),
    [ausencias, persona.id]);
  const fr = francosDe(persona, ausencias);

  const add = useMutation({
    mutationFn: () => ausenciaService.create({ persona_id: persona.id, tipo, desde, hasta, notas }),
    onSuccess: () => { setNotas(""); setError(""); qc.invalidateQueries({ queryKey: ["snapshot"] }); },
    onError: (e) => setError(apiError(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => ausenciaService.remove(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border bg-muted/40 p-2">
          <p className="text-xl font-bold tabular-nums">{fr.generados}</p>
          <p className="text-[11px] text-muted-foreground">Francos generados</p>
        </div>
        <div className="rounded-lg border bg-muted/40 p-2">
          <p className="text-xl font-bold tabular-nums text-[#F76707]">{fr.usados}</p>
          <p className="text-[11px] text-muted-foreground">Francos usados</p>
        </div>
        <div className="rounded-lg border bg-muted/40 p-2">
          <p className={`text-xl font-bold tabular-nums ${fr.restantes < 0 ? "text-destructive" : "text-green-600"}`}>{fr.restantes}</p>
          <p className="text-[11px] text-muted-foreground">Restantes</p>
        </div>
      </div>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_1fr_auto] sm:items-end"
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUS_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input type="date" className="h-9" value={desde} onChange={(e) => setDesde(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input type="date" className="h-9" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notas</Label>
          <Input className="h-9" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        </div>
        <Button type="submit" className="h-9" disabled={add.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />Agregar
        </Button>
      </form>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
        {mine.map((a) => {
          const s = toDate(a.desde), e = toDate(a.hasta);
          const dias = s && e ? daysBetween(s, e) + 1 : 0;
          return (
            <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shrink-0"
                style={{ background: AUS_COLORS[keyOf(a.tipo)] || "#868e96" }}>{a.tipo}</span>
              <span className="tabular-nums">{fmtDate(a.desde)} → {fmtDate(a.hasta)}</span>
              <span className="text-xs text-muted-foreground">({dias}d)</span>
              {a.notas && <span className="flex-1 truncate text-xs text-muted-foreground" title={a.notas}>{a.notas}</span>}
              {!a.notas && <span className="flex-1" />}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                aria-label="Eliminar ausencia" onClick={() => del.mutate(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {mine.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin ausencias registradas.</p>
        )}
      </div>
    </div>
  );
}