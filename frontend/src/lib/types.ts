export interface User {
  id: number;
  username: string;
  display_name: string;
  is_admin: boolean;
  is_active: boolean;
}

export interface Proyecto {
  id: string;
  proyecto: string;
  descripcion: string;
  responsable: string;
  responsable_tecnico: string;
  project_leader: string;
  area: string;
  yacimiento: string;
  instalacion: string;
  estado: string;
  prioridad: string;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  avance: number;
  sprint: string;
  fase: string;
  etiqueta_1: string;
  etiqueta_2: string;
  etiqueta_3: string;
  etiqueta_4: string;
  etiqueta_5: string;
  comentarios: string;
  ultima_actualizacion: string | null;
  enlaces: string;
  modo_tareas: string;
}

export interface Actividad {
  id: string;
  proyecto_id: string;
  actividad: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  avance: number;
  etiqueta: string;
  estado: string;
  depende_de: string;
  peso: number;
  orden: number;
}

export interface Comentario {
  id: string;
  actividad_id: string;
  proyecto_id: string;
  autor: string;
  fecha_hora: string;
  comentario: string;
}

export interface ChecklistItem {
  id: string;
  proyecto_id: string;
  texto: string;
  hecha: boolean;
  orden: number;
  horas_est: number | null;
  demanda: string;
}

export interface Subtarea {
  id: string;
  actividad_id: string;
  proyecto_id: string;
  texto: string;
  hecha: boolean;
  orden: number;
  horas_est: number | null;
  demanda: string;
}

export interface Hito {
  id: string;
  proyecto_id: string;
  hito: string;
  fecha: string | null;
  estado: string;
}

export interface Etiqueta {
  id: string;
  etiqueta: string;
  categoria: string;
  color_hex: string;
  activa: boolean;
}

export interface ListaValor {
  id: number;
  catalog: string;
  value: string;
  position: number;
}

export interface Persona {
  id: string;
  nombre: string;
  puesto: string;
  area: string;
  legajo: string;
  base: string;
  francos_disponibles: number;
  francos_generados: number;
  notas: string;
}

export interface Ausencia {
  id: string;
  persona_id: string;
  tipo: string;
  desde: string;
  hasta: string;
  notas: string;
}

export interface HistorialCambio {
  id: string;
  proyecto_id: string;
  campo: string;
  valor_anterior: string;
  valor_nuevo: string;
  usuario: string;
  fecha_hora: string;
}

export interface Snapshot {
  proyectos: Proyecto[];
  actividades: Actividad[];
  comentarios: Comentario[];
  subtareas: Subtarea[];
  checklist: ChecklistItem[];
  hitos: Hito[];
  etiquetas: Etiqueta[];
  listas: ListaValor[];
  personal: Persona[];
  ausencias: Ausencia[];
  historial: HistorialCambio[];
}

export const CATALOGS = [
  "Estado", "Prioridad", "Area", "Sprint", "Fase", "Responsable",
  "Responsable_Tecnico", "Project_Leader", "Yacimiento", "Instalacion",
] as const;
export type Catalog = (typeof CATALOGS)[number];

export const CATALOG_LABEL: Record<Catalog, string> = {
  Estado: "Estados", Prioridad: "Prioridades", Area: "Áreas",
  Sprint: "Sprints", Fase: "Fases", Responsable: "Responsables",
  Responsable_Tecnico: "Resp. técnicos", Project_Leader: "Project leaders",
  Yacimiento: "Yacimientos", Instalacion: "Instalaciones",
};

export const CATALOG_FIELD: Record<Catalog, keyof Proyecto> = {
  Estado: "estado", Prioridad: "prioridad", Area: "area",
  Sprint: "sprint", Fase: "fase", Responsable: "responsable",
  Responsable_Tecnico: "responsable_tecnico", Project_Leader: "project_leader",
  Yacimiento: "yacimiento", Instalacion: "instalacion",
};

export const AUS_TIPOS = ["Vacaciones", "Trámite", "Franco", "Franco Generado"] as const;

export function tagsOf(p: Proyecto): string[] {
  return [p.etiqueta_1, p.etiqueta_2, p.etiqueta_3, p.etiqueta_4, p.etiqueta_5]
    .map((t) => (t || "").trim()).filter(Boolean);
}