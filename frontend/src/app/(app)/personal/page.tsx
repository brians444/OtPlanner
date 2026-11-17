"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/modal";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { useTableStyle, tableStyles } from "@/hooks/use-table-style";
import { TableStyleSelector } from "@/components/table-style-selector";
import { keyOf } from "@/lib/format";
import { personalService } from "@/lib/services";
import type { Persona } from "@/lib/types";
import { PersonaModal } from "@/components/personal/persona-modal";
import { AusenciasPanel, francosDe } from "@/components/personal/ausencias-panel";

export default function PersonalPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;
  const { tableStyle } = useTableStyle();
  const st = tableStyles[tableStyle];
  const [search, setSearch] = useState("");
  const [formPersona, setFormPersona] = useState<Persona | null | undefined>(undefined);
  const [ausPersona, setAusPersona] = useState<Persona | null>(null);
  const [delPersona, setDelPersona] = useState<Persona | null>(null);

  const rows = useMemo(() =>
    snap.personal
      .filter((p) => !search || keyOf(p.nombre + " " + p.puesto + " " + p.area + " " + p.legajo).includes(keyOf(search)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [snap.personal, search]);

  const del = useMutation({
    mutationFn: (id: string) => personalService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["snapshot"] }); setDelPersona(null); },
  });

  const ausDe = (id: string) => snap.ausencias.filter((a) => a.persona_id === id).length;
  const ausActual = ausPersona ? snap.personal.find((p) => p.id === ausPersona.id) ?? null : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando personal…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Personal</h1>
            <p className="text-sm text-muted-foreground">
              Equipo, ausencias y francos. Las ausencias se muestran en la fila del equipo en los Gantt.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TableStyleSelector />
            <Button size="sm" onClick={() => setFormPersona(null)}>
              <Plus className="mr-2 h-4 w-4" />Nueva persona
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nombre, puesto, área, legajo…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table className={st.tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Legajo</TableHead>
                <TableHead>Base</TableHead>
                <TableHead className="text-center" title="Generados / usados / restantes">Francos (G/U/R)</TableHead>
                <TableHead className="text-center">Ausencias</TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const fr = francosDe(p, snap.ausencias);
                return (
                  <TableRow key={p.id} className={st.rowClass}>
                    <TableCell className={st.cellClass + " font-medium"}>
                      {p.nombre}
                      {p.notas && <span className="block text-[11px] text-muted-foreground truncate max-w-[220px]" title={p.notas}>{p.notas}</span>}
                    </TableCell>
                    <TableCell className={st.cellClass + " text-sm"}>{p.puesto || "—"}</TableCell>
                    <TableCell className={st.cellClass + " text-sm"}>{p.area || "—"}</TableCell>
                    <TableCell className={st.cellClass + " text-sm font-mono"}>{p.legajo || "—"}</TableCell>
                    <TableCell className={st.cellClass + " text-sm"}>{p.base || "—"}</TableCell>
                    <TableCell className={st.cellClass + " text-center text-sm tabular-nums"}>
                      <span className="font-semibold">{fr.generados}</span>
                      <span className="text-muted-foreground"> / {fr.usados} / </span>
                      <span className={fr.restantes < 0 ? "text-destructive font-bold" : "text-green-600 font-bold"}>{fr.restantes}</span>
                    </TableCell>
                    <TableCell className={st.cellClass + " text-center"}>
                      <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => setAusPersona(p)}>
                        <CalendarDays className="h-3.5 w-3.5" />{ausDe(p.id)}
                      </Button>
                    </TableCell>
                    <TableCell className={st.cellClass + " text-right"}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar" onClick={() => setFormPersona(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label="Eliminar" onClick={() => setDelPersona(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Sin personas registradas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {formPersona !== undefined && (
        <PersonaModal persona={formPersona} onClose={() => setFormPersona(undefined)} />
      )}
      {ausActual && (
        <Modal open onClose={() => setAusPersona(null)} title={`Ausencias · ${ausActual.nombre}`} size="4xl" nested>
          <AusenciasPanel persona={ausActual} ausencias={snap.ausencias} />
        </Modal>
      )}
      <ConfirmDialog open={!!delPersona} title="Eliminar persona"
        message={delPersona ? <>Se eliminará <b>{delPersona.nombre}</b> y sus {ausDe(delPersona.id)} ausencias registradas.</> : ""}
        confirmLabel="Eliminar" destructive
        onConfirm={() => delPersona && del.mutate(delPersona.id)} onCancel={() => setDelPersona(null)} />
    </div>
  );
}