from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / Users ----------
class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(ORMModel):
    id: int
    username: str
    display_name: str
    is_admin: bool
    is_active: bool


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=6)
    display_name: str = ""
    is_admin: bool = False


class UserUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=6)
    display_name: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


# ---------- Proyectos ----------
class ProyectoResponse(ORMModel):
    id: str
    proyecto: str
    descripcion: str
    responsable: str
    responsable_tecnico: str
    project_leader: str
    area: str
    yacimiento: str
    instalacion: str
    estado: str
    prioridad: str
    fecha_inicio: Optional[date]
    fecha_fin_estimada: Optional[date]
    avance: int
    sprint: str
    fase: str
    etiqueta_1: str
    etiqueta_2: str
    etiqueta_3: str
    etiqueta_4: str
    etiqueta_5: str
    comentarios: str
    ultima_actualizacion: Optional[datetime]
    enlaces: str
    modo_tareas: str


class ProyectoCreate(BaseModel):
    proyecto: str = Field(min_length=1, max_length=300)
    responsable: str = Field(min_length=1, max_length=150)
    descripcion: str = ""
    responsable_tecnico: str = ""
    project_leader: str = ""
    area: str = ""
    yacimiento: str = ""
    instalacion: str = ""
    estado: str = "Pendiente"
    prioridad: str = "Media"
    fecha_inicio: Optional[date] = None
    fecha_fin_estimada: Optional[date] = None
    avance: int = Field(default=0, ge=0, le=100)
    sprint: str = ""
    fase: str = ""
    etiquetas: List[str] = Field(default_factory=list, max_length=5)
    comentarios: str = ""
    enlaces: str = ""
    modo_tareas: str = "Gantt"


class ProyectoUpdate(BaseModel):
    proyecto: Optional[str] = Field(default=None, min_length=1, max_length=300)
    responsable: Optional[str] = Field(default=None, min_length=1, max_length=150)
    descripcion: Optional[str] = None
    responsable_tecnico: Optional[str] = None
    project_leader: Optional[str] = None
    area: Optional[str] = None
    yacimiento: Optional[str] = None
    instalacion: Optional[str] = None
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin_estimada: Optional[date] = None
    avance: Optional[int] = Field(default=None, ge=0, le=100)
    sprint: Optional[str] = None
    fase: Optional[str] = None
    etiquetas: Optional[List[str]] = Field(default=None, max_length=5)
    comentarios: Optional[str] = None
    enlaces: Optional[str] = None
    modo_tareas: Optional[str] = None


class EstadoPatch(BaseModel):
    estado: str


class NotesUpdate(BaseModel):
    comentarios: str = ""
    enlaces: str = ""


# ---------- Actividades ----------
class ActividadResponse(ORMModel):
    id: str
    proyecto_id: str
    actividad: str
    fecha_inicio: Optional[date]
    fecha_fin: Optional[date]
    avance: int
    etiqueta: str
    estado: str
    depende_de: str
    peso: float
    orden: int


class ActividadCreate(BaseModel):
    proyecto_id: str
    actividad: str = Field(min_length=1, max_length=300)
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    avance: int = Field(default=0, ge=0, le=100)
    etiqueta: str = ""
    depende_de: str = ""
    peso: float = Field(default=1.0, ge=0)


class ActividadUpdate(BaseModel):
    actividad: Optional[str] = Field(default=None, min_length=1, max_length=300)
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    avance: Optional[int] = Field(default=None, ge=0, le=100)
    etiqueta: Optional[str] = None
    depende_de: Optional[str] = None
    peso: Optional[float] = Field(default=None, ge=0)


class MoveRequest(BaseModel):
    delta_days: int


class ReorderRequest(BaseModel):
    ids: List[str]


# ---------- Comentarios ----------
class ComentarioResponse(ORMModel):
    id: str
    actividad_id: str
    proyecto_id: str
    autor: str
    fecha_hora: datetime
    comentario: str


class ComentarioCreate(BaseModel):
    actividad_id: str = ""
    proyecto_id: str = ""
    autor: str = ""
    comentario: str = Field(min_length=1)


class ComentarioUpdate(BaseModel):
    comentario: str = Field(min_length=1)


# ---------- Checklist / Subtareas ----------
class ChecklistItemResponse(ORMModel):
    id: str
    proyecto_id: str
    texto: str
    hecha: bool
    orden: int
    horas_est: Optional[float]
    demanda: str


class SubtareaResponse(ORMModel):
    id: str
    actividad_id: str
    proyecto_id: str
    texto: str
    hecha: bool
    orden: int
    horas_est: Optional[float]
    demanda: str


class ChecklistCreate(BaseModel):
    proyecto_id: str
    texto: str = Field(min_length=1)
    horas_est: Optional[float] = Field(default=None, ge=0)
    demanda: str = "Media"


class SubtareaCreate(BaseModel):
    actividad_id: str
    texto: str = Field(min_length=1)
    horas_est: Optional[float] = Field(default=None, ge=0)
    demanda: str = "Media"


class ItemUpdate(BaseModel):
    texto: Optional[str] = Field(default=None, min_length=1)
    hecha: Optional[bool] = None
    horas_est: Optional[float] = Field(default=None, ge=0)
    demanda: Optional[str] = None


# ---------- Hitos ----------
class HitoResponse(ORMModel):
    id: str
    proyecto_id: str
    hito: str
    fecha: Optional[date]
    estado: str


class HitoCreate(BaseModel):
    proyecto_id: str
    hito: str = Field(min_length=1, max_length=300)
    fecha: date
    estado: str = "Pendiente"


class HitoUpdate(BaseModel):
    hito: Optional[str] = Field(default=None, min_length=1, max_length=300)
    fecha: Optional[date] = None
    estado: Optional[str] = None


# ---------- Etiquetas ----------
class EtiquetaResponse(ORMModel):
    id: str
    etiqueta: str
    categoria: str
    color_hex: str
    activa: bool


class EtiquetaCreate(BaseModel):
    etiqueta: str = Field(min_length=1, max_length=120)
    categoria: str = "Otro"
    color_hex: str = "2C7BE5"


class EtiquetaUpdate(BaseModel):
    etiqueta: Optional[str] = Field(default=None, min_length=1, max_length=120)
    categoria: Optional[str] = None
    color_hex: Optional[str] = None
    activa: Optional[bool] = None


# ---------- Listas ----------
class ListaValorResponse(ORMModel):
    id: int
    catalog: str
    value: str
    position: int


class ListaCreate(BaseModel):
    catalog: str
    value: str = Field(min_length=1, max_length=150)


class ListaUpdate(BaseModel):
    value: str = Field(min_length=1, max_length=150)


class ListaReorder(BaseModel):
    catalog: str
    ids: List[int]


# ---------- Personal / Ausencias ----------
class PersonaResponse(ORMModel):
    id: str
    nombre: str
    puesto: str
    area: str
    legajo: str
    base: str
    francos_disponibles: int
    francos_generados: int
    notas: str


class PersonaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)


class PersonaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    puesto: Optional[str] = None
    area: Optional[str] = None
    legajo: Optional[str] = None
    base: Optional[str] = None
    francos_disponibles: Optional[int] = Field(default=None, ge=0)
    francos_generados: Optional[int] = Field(default=None, ge=0)
    notas: Optional[str] = None


class AusenciaResponse(ORMModel):
    id: str
    persona_id: str
    tipo: str
    desde: date
    hasta: date
    notas: str


class AusenciaCreate(BaseModel):
    persona_id: str
    tipo: str
    desde: date
    hasta: date
    notas: str = ""


# ---------- Historial ----------
class HistorialResponse(ORMModel):
    id: str
    proyecto_id: str
    campo: str
    valor_anterior: str
    valor_nuevo: str
    usuario: str
    fecha_hora: datetime


# ---------- Snapshot ----------
class Snapshot(BaseModel):
    proyectos: List[ProyectoResponse]
    actividades: List[ActividadResponse]
    comentarios: List[ComentarioResponse]
    subtareas: List[SubtareaResponse]
    checklist: List[ChecklistItemResponse]
    hitos: List[HitoResponse]
    etiquetas: List[EtiquetaResponse]
    listas: List[ListaValorResponse]
    personal: List[PersonaResponse]
    ausencias: List[AusenciaResponse]
    historial: List[HistorialResponse]