"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime, initials } from "@/lib/format";
import { apiError } from "@/lib/api";
import { comentarioService } from "@/lib/services";
import { useAuth } from "@/hooks/use-auth";
import type { Comentario } from "@/lib/types";

interface Props {
  comentarios: Comentario[];
  proyectoId: string;
  actividadId?: string;
  emptyText?: string;
}

export function CommentsPanel({ comentarios, proyectoId, actividadId = "", emptyText }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["snapshot"] });

  const create = useMutation({
    mutationFn: () => comentarioService.create({
      proyecto_id: proyectoId, actividad_id: actividadId,
      autor: user?.display_name || user?.username || "", comentario: text.trim(),
    }),
    onSuccess: () => { setText(""); invalidate(); },
    onError: (e) => setError(apiError(e)),
  });

  const update = useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) =>
      comentarioService.update(id, texto),
    onSuccess: () => { setEditing(null); invalidate(); },
    onError: (e) => setError(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => comentarioService.remove(id),
    onSuccess: invalidate,
  });

  const sorted = [...comentarios].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">{emptyText || "Todavía no hay mensajes. Escribí el primero abajo."}</p>
          </div>
        )}
        {sorted.map((c) => (
          <div key={c.id} className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {initials(c.autor)}
              </span>
              <b className="text-foreground">{c.autor || "—"}</b>
              <span>{fmtDateTime(c.fecha_hora)}</span>
              <span className="flex-1" />
              <button type="button" aria-label="Editar" className="hover:text-foreground"
                onClick={() => { setEditing(c.id); setEditText(c.comentario); }}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Eliminar" className="hover:text-destructive"
                onClick={() => remove.mutate(c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {editing === c.id ? (
              <div className="mt-2 space-y-2">
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button size="sm" disabled={!editText.trim() || update.isPending}
                    onClick={() => update.mutate({ id: c.id, texto: editText.trim() })}>
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.comentario}</p>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 items-end">
        <Textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="Escribir mensaje…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && text.trim()) {
              e.preventDefault();
              create.mutate();
            }
          }}
        />
        <Button size="icon" disabled={!text.trim() || create.isPending}
          onClick={() => create.mutate()} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}