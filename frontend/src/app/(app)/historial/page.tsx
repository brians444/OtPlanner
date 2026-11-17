"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSnapshot, EMPTY_SNAPSHOT } from "@/hooks/use-snapshot";
import { HistoryPanel } from "@/components/project/history-panel";

const ALL = "__all__";

export default function HistorialPage() {
  const { data, isLoading } = useSnapshot();
  const snap = data ?? EMPTY_SNAPSHOT;
  const [pid, setPid] = useState(ALL);

  const entries = useMemo(() =>
    pid === ALL ? snap.historial : snap.historial.filter((h) => h.proyecto_id === pid),
    [snap.historial, pid]);

  const proyectosConHist = useMemo(() => {
    const ids = new Set(snap.historial.map((h) => h.proyecto_id));
    return snap.proyectos.filter((p) => ids.has(p.id));
  }, [snap.historial, snap.proyectos]);

  const nameOf = (id: string) => snap.proyectos.find((p) => p.id === id)?.proyecto || "(eliminado)";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando historial…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Historial de cambios</h1>
            <p className="text-sm text-muted-foreground">Auditoría de cambios en proyectos, con usuario y fecha.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Proyecto</Label>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los proyectos</SelectItem>
                {proyectosConHist.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.id} · {p.proyecto}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <HistoryPanel entries={entries} proyectoId={pid === ALL ? "" : pid}
          showProject projectName={nameOf} />
      </div>
    </div>
  );
}