"use client";

import { useMemo, useState } from "react";
import { keyOf, midnight, norm, toDate } from "@/lib/format";
import { tagCat } from "@/lib/colors";
import { tagsOf, type Actividad, type Etiqueta, type Proyecto } from "@/lib/types";

export type FilterKey =
  | "resp" | "resptec" | "pleader" | "prio" | "fase"
  | "area" | "yacim" | "insta" | "cat" | "tag";

export const FILTER_DEFS: { key: FilterKey; label: string; field: keyof Proyecto | null }[] = [
  { key: "resp", label: "Responsable", field: "responsable" },
  { key: "resptec", label: "Resp. Técnico", field: "responsable_tecnico" },
  { key: "pleader", label: "Project Leader", field: "project_leader" },
  { key: "prio", label: "Prioridad", field: "prioridad" },
  { key: "fase", label: "Fase", field: "fase" },
  { key: "area", label: "Área", field: "area" },
  { key: "yacim", label: "Yacimiento", field: "yacimiento" },
  { key: "insta", label: "Instalación", field: "instalacion" },
  { key: "cat", label: "Categoría", field: null },
  { key: "tag", label: "Etiquetas", field: null },
];

export type FilterSel = Record<FilterKey, Set<string>>;

export const emptyFilters = (): FilterSel => ({
  resp: new Set(), resptec: new Set(), pleader: new Set(), prio: new Set(),
  fase: new Set(), area: new Set(), yacim: new Set(), insta: new Set(),
  cat: new Set(), tag: new Set(),
});

const normSearch = (s: string) => keyOf(s);

export function useBoardFilters(proyectos: Proyecto[], actividades: Actividad[], etiquetas: Etiqueta[]) {
  const [sel, setSel] = useState<FilterSel>(emptyFilters);
  const [tagLogic, setTagLogic] = useState<"AND" | "OR">("OR");
  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const setOne = (key: FilterKey, next: Set<string>) =>
    setSel((s) => ({ ...s, [key]: next }));

  const clearAll = () => {
    setSel(emptyFilters());
    setSearch("");
    setDesde("");
    setHasta("");
  };

  const totalSelected = Object.values(sel).reduce((n, s) => n + s.size, 0);

  const actsByProject = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of actividades) {
      map.set(a.proyecto_id, (map.get(a.proyecto_id) || "") + " " + keyOf(a.actividad));
    }
    return map;
  }, [actividades]);

  const filtered = useMemo(() => {
    const q = normSearch(search);
    const dDesde = desde ? midnight(toDate(desde)!) : null;
    const dHasta = hasta ? midnight(toDate(hasta)!) : null;
    return proyectos.filter((p) => {
      if (q) {
        const hay = keyOf([
          p.id, p.proyecto, p.descripcion, p.responsable, p.responsable_tecnico,
          p.project_leader, p.area, p.yacimiento, p.instalacion, p.estado,
          p.sprint, p.fase, p.comentarios, ...tagsOf(p),
        ].join(" "));
        const acts = actsByProject.get(p.id) || "";
        if (!hay.includes(q) && !acts.includes(q)) return false;
      }
      if (dDesde || dHasta) {
        const d = toDate(p.fecha_fin_estimada);
        if (!d) return false;
        const dm = midnight(d);
        if (dDesde && dm < dDesde) return false;
        if (dHasta && dm > dHasta) return false;
      }
      for (const def of FILTER_DEFS) {
        if (!def.field) continue;
        const s = sel[def.key];
        if (s.size && !s.has(norm(p[def.field] as string))) return false;
      }
      const tg = tagsOf(p);
      if (sel.cat.size && !tg.some((t) => sel.cat.has(tagCat(t, etiquetas)))) return false;
      if (sel.tag.size) {
        const chosen = [...sel.tag];
        if (tagLogic === "AND") {
          if (!chosen.every((t) => tg.some((x) => keyOf(x) === keyOf(t)))) return false;
        } else if (!chosen.some((t) => tg.some((x) => keyOf(x) === keyOf(t)))) return false;
      }
      return true;
    });
  }, [proyectos, sel, tagLogic, search, desde, hasta, etiquetas, actsByProject]);

  return {
    sel, setOne, tagLogic, setTagLogic, search, setSearch,
    desde, setDesde, hasta, setHasta, clearAll, totalSelected, filtered,
  };
}