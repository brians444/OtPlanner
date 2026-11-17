"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { estadoColor } from "@/lib/colors";
import { keyOf } from "@/lib/format";

const WIP_KEY = "kanbanWIP";

export function loadWip(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(WIP_KEY) || "{}");
  } catch {
    return {};
  }
}

interface WipModalProps {
  open: boolean;
  onClose: () => void;
  estados: string[];
  wip: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

export function WipModal({ open, onClose, estados, wip, onChange }: WipModalProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const d: Record<string, string> = {};
      for (const e of estados) d[keyOf(e)] = wip[keyOf(e)] ? String(wip[keyOf(e)]) : "";
      setDraft(d);
    }
  }, [open, estados, wip]);

  const commit = (k: string, v: string) => {
    const next = { ...wip };
    const n = parseInt(v, 10);
    if (n > 0) next[k] = n; else delete next[k];
    localStorage.setItem(WIP_KEY, JSON.stringify(next));
    onChange(next);
  };

  return (
    <Modal open={open} onClose={onClose} title="Límites WIP por columna" size="md">
      <p className="text-sm text-muted-foreground mb-3">
        Cantidad máxima de proyectos por columna. Dejar vacío = sin límite.
      </p>
      <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto">
        {estados.map((e, i) => (
          <div key={e} className="flex items-center gap-2.5 rounded-md border px-3 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: estadoColor(e, i) }} />
            <span className="flex-1 text-sm font-semibold">{e}</span>
            <Input
              type="number" min={0} placeholder="∞" className="w-20 h-8"
              value={draft[keyOf(e)] ?? ""}
              onChange={(ev) => setDraft((d) => ({ ...d, [keyOf(e)]: ev.target.value }))}
              onBlur={(ev) => commit(keyOf(e), ev.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4">
        <Button variant="ghost" className="text-destructive" onClick={() => {
          localStorage.setItem(WIP_KEY, "{}");
          onChange({});
          setDraft({});
        }}>
          Quitar todos
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}