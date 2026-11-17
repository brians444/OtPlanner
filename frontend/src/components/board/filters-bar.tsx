"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "./multi-select";
import { FILTER_DEFS, type FilterKey, type FilterSel } from "@/hooks/use-board-filters";
import { tagCat, tagColor } from "@/lib/colors";
import { norm } from "@/lib/format";
import { CATALOG_FIELD, tagsOf, type Catalog, type Etiqueta, type ListaValor, type Proyecto } from "@/lib/types";

interface FiltersBarProps {
  proyectos: Proyecto[];
  listas: ListaValor[];
  etiquetas: Etiqueta[];
  sel: FilterSel;
  setOne: (k: FilterKey, s: Set<string>) => void;
  tagLogic: "AND" | "OR";
  setTagLogic: (l: "AND" | "OR") => void;
  search: string;
  setSearch: (s: string) => void;
  desde: string;
  setDesde: (s: string) => void;
  hasta: string;
  setHasta: (s: string) => void;
  clearAll: () => void;
}

const FIELD_TO_CATALOG: Partial<Record<FilterKey, Catalog>> = {
  resp: "Responsable", resptec: "Responsable_Tecnico", pleader: "Project_Leader",
  prio: "Prioridad", fase: "Fase", area: "Area", yacim: "Yacimiento", insta: "Instalacion",
};

export function FiltersBar(props: FiltersBarProps) {
  const { proyectos, listas, etiquetas, sel, setOne, tagLogic, setTagLogic } = props;

  const optionsFor = (key: FilterKey): string[] => {
    if (key === "tag") {
      return etiquetas.filter((t) => t.activa).map((t) => t.etiqueta);
    }
    if (key === "cat") {
      return [...new Set(etiquetas.map((t) => t.categoria).filter(Boolean))].sort();
    }
    const cat = FIELD_TO_CATALOG[key];
    const fromList = cat ? listas.filter((l) => l.catalog === cat).map((l) => l.value) : [];
    const field = cat ? CATALOG_FIELD[cat] : null;
    const fromData = field ? proyectos.map((p) => norm(p[field] as string)).filter(Boolean) : [];
    return [...new Set([...fromList, ...fromData])].sort((a, b) => a.localeCompare(b));
  };

  const chips: { key: FilterKey; label: string; values: string[] }[] = [];
  for (const def of FILTER_DEFS) {
    if (sel[def.key].size) {
      chips.push({
        key: def.key,
        label: def.key === "tag" ? `Etiquetas (${tagLogic === "AND" ? "Y" : "O"})` : def.label,
        values: [...sel[def.key]],
      });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Buscar proyectos, actividades, tags…"
            className="pl-8 pr-8 h-9"
          />
          {props.search && (
            <button type="button" aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => props.setSearch("")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Fin entre</span>
          <Input type="date" value={props.desde} onChange={(e) => props.setDesde(e.target.value)} className="h-9 w-[140px] text-xs" />
          <span>y</span>
          <Input type="date" value={props.hasta} onChange={(e) => props.setHasta(e.target.value)} className="h-9 w-[140px] text-xs" />
          {(props.desde || props.hasta) && (
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Limpiar fechas"
              onClick={() => { props.setDesde(""); props.setHasta(""); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_DEFS.map((def) => (
          <MultiSelect
            key={def.key}
            label={def.label}
            options={optionsFor(def.key)}
            selected={sel[def.key]}
            onChange={(s) => setOne(def.key, s)}
            colorOf={def.key === "tag" ? (v) => tagColor(v, etiquetas) : undefined}
            logic={def.key === "tag" ? tagLogic : undefined}
            onLogicChange={def.key === "tag" ? setTagLogic : undefined}
          />
        ))}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
              <b>{c.label}:</b> {c.values.join(", ")}
              <button type="button" aria-label={`Quitar filtro ${c.label}`} className="ml-0.5 hover:text-destructive"
                onClick={() => setOne(c.key, new Set())}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={props.clearAll}
            className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20">
            Limpiar todo ✕
          </button>
        </div>
      )}
    </div>
  );
}