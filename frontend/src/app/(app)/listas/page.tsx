"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/modal";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { apiError } from "@/lib/api";
import { keyOf } from "@/lib/format";
import { listaService } from "@/lib/services";
import { CATALOGS, CATALOG_FIELD, CATALOG_LABEL, type Catalog, type ListaValor } from "@/lib/types";

export default function ListasPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;
  const [catalog, setCatalog] = useState<Catalog>("Estado");
  const [nuevo, setNuevo] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [delVal, setDelVal] = useState<ListaValor | null>(null);
  const [error, setError] = useState("");

  const values = useMemo(() =>
    snap.listas.filter((l) => l.catalog === catalog).sort((a, b) => a.position - b.position || a.id - b.id),
    [snap.listas, catalog]);

  const usage = useMemo(() => {
    const field = CATALOG_FIELD[catalog];
    const map = new Map<string, number>();
    for (const p of snap.proyectos) {
      const k = keyOf(p[field] as string);
      if (k) map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [snap.proyectos, catalog]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["snapshot"] });
  const fail = (e: unknown) => setError(apiError(e));

  const add = useMutation({
    mutationFn: () => listaService.create(catalog, nuevo.trim()),
    onSuccess: () => { setNuevo(""); invalidate(); },
    onError: fail,
  });
  const rename = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string }) => listaService.update(id, value),
    onSuccess: () => { setEditing(null); invalidate(); },
    onError: fail,
  });
  const del = useMutation({
    mutationFn: (id: number) => listaService.remove(id),
    onSuccess: () => { setDelVal(null); invalidate(); },
    onError: (e) => { fail(e); setDelVal(null); },
  });
  const move = useMutation({
    mutationFn: (ids: number[]) => listaService.reorder(catalog, ids),
    onSettled: invalidate,
    onError: fail,
  });

  const moveRow = (idx: number, dir: -1 | 1) => {
    const ids = values.map((v) => v.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    move.mutate(ids);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando listas…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Listas desplegables</h1>
          <p className="text-sm text-muted-foreground">
            Valores de los selectores del proyecto. Renombrar propaga a todos los proyectos; eliminar limpia el campo.
          </p>
        </div>

        <Tabs value={catalog} onValueChange={(v) => { setCatalog(v as Catalog); setEditing(null); setError(""); }}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            {CATALOGS.map((c) => (
              <TabsTrigger key={c} value={c} className="text-xs">
                {CATALOG_LABEL[c]}
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                  {snap.listas.filter((l) => l.catalog === c).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nuevo.trim()) add.mutate(); }}>
          <Input placeholder={`Nuevo valor en ${CATALOG_LABEL[catalog]}…`} value={nuevo}
            onChange={(e) => setNuevo(e.target.value)} />
          <Button type="submit" disabled={!nuevo.trim() || add.isPending}>
            <Plus className="mr-2 h-4 w-4" />Agregar
          </Button>
        </form>

        <div className="rounded-lg border bg-card divide-y">
          {values.map((v, i) => (
            <div key={v.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex flex-col">
                <button type="button" aria-label="Subir" disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                  onClick={() => moveRow(i, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" aria-label="Bajar" disabled={i === values.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                  onClick={() => moveRow(i, 1)}>
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              {editing === v.id ? (
                <form className="flex flex-1 items-center gap-1.5"
                  onSubmit={(e) => { e.preventDefault(); if (editText.trim()) rename.mutate({ id: v.id, value: editText.trim() }); }}>
                  <Input className="h-8" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                  <Button type="submit" size="icon" variant="ghost" className="h-7 w-7" aria-label="Guardar">
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Cancelar"
                    onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{v.value}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground"
                    title="Proyectos que usan este valor">
                    {usage.get(keyOf(v.value)) || 0} usos
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Renombrar"
                    onClick={() => { setEditing(v.id); setEditText(v.value); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    aria-label="Eliminar" onClick={() => setDelVal(v)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {values.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Lista vacía. Agregá el primer valor.</p>
          )}
        </div>
      </div>

      <ConfirmDialog open={!!delVal} title="Eliminar valor"
        message={delVal ? <>Se eliminará <b>{delVal.value}</b> de {CATALOG_LABEL[catalog]} y se limpiará el campo en {usage.get(keyOf(delVal.value)) || 0} proyectos.</> : ""}
        confirmLabel="Eliminar" destructive
        onConfirm={() => delVal && del.mutate(delVal.id)} onCancel={() => setDelVal(null)} />
    </div>
  );
}