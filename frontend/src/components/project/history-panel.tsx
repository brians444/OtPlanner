"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/modal";
import { useAuth } from "@/hooks/use-auth";
import { fmtDateTime } from "@/lib/format";
import { historialService } from "@/lib/services";
import type { HistorialCambio } from "@/lib/types";

interface Props {
  entries: HistorialCambio[];
  proyectoId?: string;
  showProject?: boolean;
  projectName?: (id: string) => string;
}

export function HistoryPanel({ entries, proyectoId = "", showProject, projectName }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmClear, setConfirmClear] = useState(false);

  const sorted = [...entries].sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora));

  const del = useMutation({
    mutationFn: (id: string) => historialService.remove(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
  });
  const clear = useMutation({
    mutationFn: () => historialService.clear(proyectoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshot"] });
      setConfirmClear(false);
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sorted.length} cambio{sorted.length === 1 ? "" : "s"} registrado{sorted.length === 1 ? "" : "s"}</p>
        {user?.is_admin && sorted.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />Vaciar historial
          </Button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin cambios registrados.</p>
      ) : (
        <div className="rounded-lg border divide-y max-h-[55vh] overflow-y-auto">
          {sorted.map((h) => (
            <div key={h.id} className="flex items-start gap-2 px-3 py-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold">{h.campo}</span>
                  {showProject && projectName && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {h.proyecto_id} · {projectName(h.proyecto_id)}
                    </span>
                  )}
                  <span className="text-muted-foreground">{fmtDateTime(h.fecha_hora)} · {h.usuario || "—"}</span>
                </div>
                <div className="mt-0.5 text-muted-foreground break-words">
                  <span className="line-through opacity-70">{h.valor_anterior || "(vacío)"}</span>
                  <span className="mx-1.5">→</span>
                  <span className="text-foreground font-medium">{h.valor_nuevo || "(vacío)"}</span>
                </div>
              </div>
              {user?.is_admin && (
                <button type="button" aria-label="Eliminar registro"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => del.mutate(h.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog open={confirmClear} title="Vaciar historial"
        message={proyectoId ? "Se eliminarán todos los registros de historial de este proyecto. Esta acción no se puede deshacer."
          : "Se eliminarán todos los registros de historial. Esta acción no se puede deshacer."}
        confirmLabel="Vaciar" destructive
        onConfirm={() => clear.mutate()} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}