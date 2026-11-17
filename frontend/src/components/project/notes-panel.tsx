"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiError } from "@/lib/api";
import { proyectoService } from "@/lib/services";
import type { Proyecto } from "@/lib/types";

export function parseLinks(raw: string): { label: string; url: string }[] {
  return (raw || "").split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const i = line.indexOf("|");
    if (i >= 0) {
      return { label: line.slice(0, i).trim() || line.slice(i + 1).trim(), url: line.slice(i + 1).trim() };
    }
    return { label: line, url: line };
  }).filter((l) => /^https?:\/\//i.test(l.url));
}

export function NotesPanel({ proyecto }: { proyecto: Proyecto }) {
  const qc = useQueryClient();
  const [comentarios, setComentarios] = useState(proyecto.comentarios || "");
  const [enlaces, setEnlaces] = useState(proyecto.enlaces || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty = comentarios !== (proyecto.comentarios || "") || enlaces !== (proyecto.enlaces || "");
  const links = parseLinks(enlaces);

  const save = useMutation({
    mutationFn: () => proyectoService.setNotes(proyecto.id, comentarios, enlaces),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => setError(apiError(e)),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Notas del proyecto</Label>
        <Textarea rows={6} value={comentarios} onChange={(e) => setComentarios(e.target.value)}
          placeholder="Notas, decisiones, contexto del proyecto…" />
      </div>
      <div className="space-y-1.5">
        <Label>Enlaces (uno por línea, formato: Título | https://…)</Label>
        <Textarea rows={3} value={enlaces} onChange={(e) => setEnlaces(e.target.value)}
          placeholder={"Plano P&ID | https://ejemplo.com/plano\nCarpeta del proyecto | https://ejemplo.com/carpeta"} />
        {links.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium hover:bg-accent">
                <ExternalLink className="h-3 w-3" />{l.label}
              </a>
            ))}
          </div>
        )}
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save className="mr-2 h-4 w-4" />{save.isPending ? "Guardando…" : "Guardar notas"}
        </Button>
        {saved && <span className="text-xs text-green-600 font-medium">Guardado ✓</span>}
      </div>
    </div>
  );
}