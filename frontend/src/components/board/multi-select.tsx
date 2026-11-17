"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  colorOf?: (v: string) => string;
  logic?: "AND" | "OR";
  onLogicChange?: (l: "AND" | "OR") => void;
}

export function MultiSelect({ label, options, selected, onChange, colorOf, logic, onLogicChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = options.filter((v) => !q || v.toLowerCase().includes(q.toLowerCase()));
  const n = selected.size;
  const btnLabel = n === 0 ? "Todas" : n === 1 ? [...selected][0] : `${n} sel.`;

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium hover:bg-accent transition-colors",
          n > 0 && "border-primary/60"
        )}
      >
        <span className="text-muted-foreground">{label}:</span>
        <span className="max-w-[90px] truncate">{btnLabel}</span>
        {n > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {n}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
          <div className="flex gap-1 mb-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-8 text-xs" />
            <button type="button" title="Limpiar" aria-label="Limpiar selección"
              className="rounded-md border px-2 text-muted-foreground hover:bg-accent"
              onClick={() => onChange(new Set())}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {onLogicChange && (
            <div className="flex gap-1 mb-2">
              {(["OR", "AND"] as const).map((l) => (
                <button key={l} type="button" onClick={() => onLogicChange(l)}
                  className={cn("flex-1 rounded border px-2 py-1 text-xs font-semibold",
                    logic === l ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}>
                  {l === "OR" ? "O (alguna)" : "Y (todas)"}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filtered.length === 0 && <p className="p-2 text-xs text-muted-foreground">Sin opciones</p>}
            {filtered.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent">
                <Checkbox checked={selected.has(v)} onCheckedChange={() => toggle(v)} />
                {colorOf && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(v) }} />}
                <span className="truncate">{v}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}