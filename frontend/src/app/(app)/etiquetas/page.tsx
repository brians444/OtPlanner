"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/modal";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { useTableStyle, tableStyles } from "@/hooks/use-table-style";
import { TableStyleSelector } from "@/components/table-style-selector";
import { apiError } from "@/lib/api";
import { keyOf } from "@/lib/format";
import { etiquetaService } from "@/lib/services";
import { tagsOf, type Etiqueta } from "@/lib/types";

const CATS = ["Proyecto", "Actividad", "Sistema", "Disciplina", "Otro"];

function TagForm({ tag, categorias, onClose }: { tag: Etiqueta | null; categorias: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(tag?.etiqueta || "");
  const [categoria, setCategoria] = useState(tag?.categoria || "Otro");
  const [color, setColor] = useState("#" + (tag?.color_hex || "2C7BE5").replace("#", ""));
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => tag
      ? etiquetaService.update(tag.id, { etiqueta: nombre.trim(), categoria, color_hex: color })
      : etiquetaService.create({ etiqueta: nombre.trim(), categoria, color_hex: color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      onClose();
    },
    onError: (e) => setError(apiError(e)),
  });

  const cats = [...new Set([...CATS, ...categorias])];

  return (
    <Modal open onClose={onClose} title={tag ? "Editar etiqueta" : "Nueva etiqueta"} size="md" nested>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) save.mutate(); }}>
        <div className="space-y-1.5">
          <Label>Nombre *</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          {tag && <p className="text-xs text-muted-foreground">Renombrar propaga el cambio a todos los proyectos y actividades que la usan.</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Input list="tag-cats" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          <datalist id="tag-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border bg-transparent" />
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: color }}>
              {nombre || "Vista previa"}
            </span>
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

export default function EtiquetasPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;
  const { tableStyle } = useTableStyle();
  const st = tableStyles[tableStyle];
  const [search, setSearch] = useState("");
  const [formTag, setFormTag] = useState<Etiqueta | null | undefined>(undefined);
  const [delTag, setDelTag] = useState<Etiqueta | null>(null);
  const [error, setError] = useState("");

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of snap.proyectos) for (const t of tagsOf(p)) {
      const k = keyOf(t);
      map.set(k, (map.get(k) || 0) + 1);
    }
    for (const a of snap.actividades) if (a.etiqueta) {
      const k = keyOf(a.etiqueta);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [snap.proyectos, snap.actividades]);

  const rows = useMemo(() =>
    snap.etiquetas
      .filter((t) => !search || keyOf(t.etiqueta + " " + t.categoria).includes(keyOf(search)))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
    [snap.etiquetas, search]);

  const toggle = useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) => etiquetaService.update(id, { activa }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => etiquetaService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      setDelTag(null);
    },
    onError: (e) => { setError(apiError(e)); setDelTag(null); },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando etiquetas…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Etiquetas</h1>
            <p className="text-sm text-muted-foreground">Renombrar o eliminar propaga el cambio a proyectos y actividades.</p>
          </div>
          <div className="flex items-center gap-2">
            <TableStyleSelector />
            <Button size="sm" onClick={() => setFormTag(null)}>
              <Plus className="mr-2 h-4 w-4" />Nueva etiqueta
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar etiqueta o categoría…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="rounded-lg border bg-card">
          <Table className={st.tableClass}>
            <TableHeader>
              <TableRow>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-center">Usos</TableHead>
                <TableHead className="text-center">Activa</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className={st.rowClass}>
                  <TableCell className={st.cellClass}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border" style={{ background: "#" + t.color_hex.replace("#", "") }} />
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                        style={{ background: "#" + t.color_hex.replace("#", "") }}>{t.etiqueta}</span>
                    </span>
                  </TableCell>
                  <TableCell className={st.cellClass + " text-sm"}>{t.categoria}</TableCell>
                  <TableCell className={st.cellClass + " text-center tabular-nums text-sm"}>{usage.get(keyOf(t.etiqueta)) || 0}</TableCell>
                  <TableCell className={st.cellClass + " text-center"}>
                    <Switch checked={t.activa} onCheckedChange={(v) => toggle.mutate({ id: t.id, activa: v })} aria-label="Activa" />
                  </TableCell>
                  <TableCell className={st.cellClass + " text-right"}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFormTag(t)} aria-label="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDelTag(t)} aria-label="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Sin etiquetas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {formTag !== undefined && (
        <TagForm tag={formTag} categorias={snap.etiquetas.map((t) => t.categoria)} onClose={() => setFormTag(undefined)} />
      )}
      <ConfirmDialog open={!!delTag} title="Eliminar etiqueta"
        message={delTag ? <>Se eliminará <b>{delTag.etiqueta}</b> y se quitará de {usage.get(keyOf(delTag.etiqueta)) || 0} usos en proyectos y actividades.</> : ""}
        confirmLabel="Eliminar" destructive
        onConfirm={() => delTag && del.mutate(delTag.id)} onCancel={() => setDelTag(null)} />
    </div>
  );
}