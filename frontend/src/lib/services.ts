import { api } from "./api";
import type {
  Actividad, Ausencia, ChecklistItem, Comentario, Etiqueta, Hito,
  HistorialCambio, ListaValor, Persona, Proyecto, Snapshot, Subtarea, User,
} from "./types";

export const snapshotService = {
  get: async (): Promise<Snapshot> => (await api.get("/snapshot")).data,
};

export const authService = {
  login: async (username: string, password: string) => {
    const form = new URLSearchParams({ username, password });
    const r = await api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return r.data as { access_token: string; refresh_token: string };
  },
  me: async (): Promise<User> => (await api.get("/auth/me")).data,
};

export const proyectoService = {
  create: async (payload: Partial<Proyecto> & { etiquetas?: string[] }): Promise<Proyecto> =>
    (await api.post("/proyectos", payload)).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<Proyecto> =>
    (await api.put(`/proyectos/${id}`, payload)).data,
  setEstado: async (id: string, estado: string): Promise<Proyecto> =>
    (await api.patch(`/proyectos/${id}/estado`, { estado })).data,
  setNotes: async (id: string, comentarios: string, enlaces: string): Promise<Proyecto> =>
    (await api.put(`/proyectos/${id}/notes`, { comentarios, enlaces })).data,
  duplicate: async (id: string): Promise<Proyecto> =>
    (await api.post(`/proyectos/${id}/duplicate`)).data,
  recalcActs: async (id: string): Promise<{ changed: number }> =>
    (await api.post(`/proyectos/${id}/recalc-acts`)).data,
  remove: async (id: string) => (await api.delete(`/proyectos/${id}`)).data,
};

export const actividadService = {
  create: async (payload: Partial<Actividad>): Promise<Actividad> =>
    (await api.post("/actividades", payload)).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<Actividad> =>
    (await api.put(`/actividades/${id}`, payload)).data,
  move: async (id: string, delta_days: number) =>
    (await api.post(`/actividades/${id}/move`, { delta_days })).data,
  reorder: async (ids: string[]) => (await api.post("/actividades/reorder", { ids })).data,
  done: async (id: string, done: boolean): Promise<Actividad> =>
    (await api.post(`/actividades/${id}/done`, { done })).data,
  applyChecklist: async (id: string): Promise<Actividad> =>
    (await api.post(`/actividades/${id}/apply-checklist`)).data,
  remove: async (id: string) => (await api.delete(`/actividades/${id}`)).data,
};

export const comentarioService = {
  create: async (payload: Partial<Comentario>): Promise<Comentario> =>
    (await api.post("/comentarios", payload)).data,
  update: async (id: string, comentario: string): Promise<Comentario> =>
    (await api.put(`/comentarios/${id}`, { comentario })).data,
  remove: async (id: string) => (await api.delete(`/comentarios/${id}`)).data,
};

export const checklistService = {
  create: async (payload: Partial<ChecklistItem>): Promise<ChecklistItem> =>
    (await api.post("/checklist", payload)).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<ChecklistItem> =>
    (await api.put(`/checklist/${id}`, payload)).data,
  reorder: async (ids: string[]) => (await api.post("/checklist/reorder", { ids })).data,
  remove: async (id: string) => (await api.delete(`/checklist/${id}`)).data,
};

export const subtareaService = {
  create: async (payload: Partial<Subtarea>): Promise<Subtarea> =>
    (await api.post("/subtareas", payload)).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<Subtarea> =>
    (await api.put(`/subtareas/${id}`, payload)).data,
  reorder: async (ids: string[]) => (await api.post("/subtareas/reorder", { ids })).data,
  remove: async (id: string) => (await api.delete(`/subtareas/${id}`)).data,
};

export const hitoService = {
  create: async (payload: Partial<Hito>): Promise<Hito> =>
    (await api.post("/hitos", payload)).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<Hito> =>
    (await api.put(`/hitos/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/hitos/${id}`)).data,
};

export const etiquetaService = {
  create: async (payload: Partial<Etiqueta>): Promise<Etiqueta> =>
    (await api.post("/etiquetas", payload)).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<Etiqueta> =>
    (await api.put(`/etiquetas/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/etiquetas/${id}`)).data,
};

export const listaService = {
  create: async (catalog: string, value: string): Promise<ListaValor> =>
    (await api.post("/listas", { catalog, value })).data,
  update: async (id: number, value: string): Promise<ListaValor> =>
    (await api.put(`/listas/${id}`, { value })).data,
  reorder: async (catalog: string, ids: number[]) =>
    (await api.post("/listas/reorder", { catalog, ids })).data,
  remove: async (id: number) => (await api.delete(`/listas/${id}`)).data,
};

export const personalService = {
  list: async (): Promise<Persona[]> => (await api.get("/personal")).data,
  create: async (nombre: string): Promise<Persona> =>
    (await api.post("/personal", { nombre })).data,
  update: async (id: string, payload: Record<string, unknown>): Promise<Persona> =>
    (await api.put(`/personal/${id}`, payload)).data,
  remove: async (id: string) => (await api.delete(`/personal/${id}`)).data,
};

export const ausenciaService = {
  create: async (payload: Partial<Ausencia>): Promise<Ausencia> =>
    (await api.post("/ausencias", payload)).data,
  remove: async (id: string) => (await api.delete(`/ausencias/${id}`)).data,
};

export const historialService = {
  list: async (proyecto_id = ""): Promise<HistorialCambio[]> =>
    (await api.get("/historial", { params: { proyecto_id } })).data,
  remove: async (id: string) => (await api.delete(`/historial/${id}`)).data,
  clear: async (proyecto_id = "") =>
    (await api.delete("/historial", { params: { proyecto_id } })).data,
};

export const userService = {
  list: async (): Promise<User[]> => (await api.get("/users")).data,
  create: async (payload: Record<string, unknown>): Promise<User> =>
    (await api.post("/users", payload)).data,
  update: async (id: number, payload: Record<string, unknown>): Promise<User> =>
    (await api.put(`/users/${id}`, payload)).data,
  remove: async (id: number) => (await api.delete(`/users/${id}`)).data,
};

export const excelService = {
  exportUrl: () => api.getUri({ url: "/excel/export" }),
  download: async () => {
    const r = await api.get("/excel/export", { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = (r.headers["content-disposition"] || "").match(/filename="(.+)"/)?.[1]
      || "PlannerOT.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  },
  import: async (file: File, replace = true) => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post("/excel/import", fd, { params: { replace } })).data;
  },
};