from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120), default="")
    hashed_password: Mapped[str] = mapped_column(String(128))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Proyecto(Base):
    __tablename__ = "proyectos"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # PRY-001
    proyecto: Mapped[str] = mapped_column(String(300))
    descripcion: Mapped[str] = mapped_column(Text, default="")
    responsable: Mapped[str] = mapped_column(String(150), default="")
    responsable_tecnico: Mapped[str] = mapped_column(String(150), default="")
    project_leader: Mapped[str] = mapped_column(String(150), default="")
    area: Mapped[str] = mapped_column(String(120), default="")
    yacimiento: Mapped[str] = mapped_column(String(120), default="")
    instalacion: Mapped[str] = mapped_column(String(120), default="")
    estado: Mapped[str] = mapped_column(String(80), default="Pendiente")
    prioridad: Mapped[str] = mapped_column(String(40), default="Media")
    fecha_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    fecha_fin_estimada: Mapped[date | None] = mapped_column(Date, nullable=True)
    avance: Mapped[int] = mapped_column(Integer, default=0)
    sprint: Mapped[str] = mapped_column(String(80), default="")
    fase: Mapped[str] = mapped_column(String(80), default="")
    etiqueta_1: Mapped[str] = mapped_column(String(120), default="")
    etiqueta_2: Mapped[str] = mapped_column(String(120), default="")
    etiqueta_3: Mapped[str] = mapped_column(String(120), default="")
    etiqueta_4: Mapped[str] = mapped_column(String(120), default="")
    etiqueta_5: Mapped[str] = mapped_column(String(120), default="")
    comentarios: Mapped[str] = mapped_column(Text, default="")
    ultima_actualizacion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    enlaces: Mapped[str] = mapped_column(Text, default="")
    modo_tareas: Mapped[str] = mapped_column(String(20), default="Gantt")


class Actividad(Base):
    __tablename__ = "actividades"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # ACT-001
    proyecto_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("proyectos.id", ondelete="CASCADE"), index=True)
    actividad: Mapped[str] = mapped_column(String(300))
    fecha_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    fecha_fin: Mapped[date | None] = mapped_column(Date, nullable=True)
    avance: Mapped[int] = mapped_column(Integer, default=0)
    etiqueta: Mapped[str] = mapped_column(String(120), default="")
    estado: Mapped[str] = mapped_column(String(80), default="Pendiente")
    depende_de: Mapped[str] = mapped_column(String(20), default="")
    peso: Mapped[float] = mapped_column(Float, default=1.0)
    orden: Mapped[int] = mapped_column(Integer, default=0)


class Comentario(Base):
    __tablename__ = "comentarios"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # COM-001
    actividad_id: Mapped[str] = mapped_column(String(20), default="", index=True)
    proyecto_id: Mapped[str] = mapped_column(String(20), default="", index=True)
    autor: Mapped[str] = mapped_column(String(120), default="")
    fecha_hora: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    comentario: Mapped[str] = mapped_column(Text)


class Subtarea(Base):
    __tablename__ = "subtareas"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # SUB-001
    actividad_id: Mapped[str] = mapped_column(String(20), index=True)
    proyecto_id: Mapped[str] = mapped_column(String(20), default="")
    texto: Mapped[str] = mapped_column(Text)
    hecha: Mapped[bool] = mapped_column(Boolean, default=False)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    horas_est: Mapped[float | None] = mapped_column(Float, nullable=True)
    demanda: Mapped[str] = mapped_column(String(20), default="Media")


class ChecklistItem(Base):
    __tablename__ = "checklist_proyecto"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # CHK-0001
    proyecto_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("proyectos.id", ondelete="CASCADE"), index=True)
    texto: Mapped[str] = mapped_column(Text)
    hecha: Mapped[bool] = mapped_column(Boolean, default=False)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    horas_est: Mapped[float | None] = mapped_column(Float, nullable=True)
    demanda: Mapped[str] = mapped_column(String(20), default="Media")


class Hito(Base):
    __tablename__ = "hitos"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # HITO-001
    proyecto_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("proyectos.id", ondelete="CASCADE"), index=True)
    hito: Mapped[str] = mapped_column(String(300))
    fecha: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(40), default="Pendiente")


class Etiqueta(Base):
    __tablename__ = "etiquetas"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # ET-01
    etiqueta: Mapped[str] = mapped_column(String(120), unique=True)
    categoria: Mapped[str] = mapped_column(String(80), default="Otro")
    color_hex: Mapped[str] = mapped_column(String(10), default="2C7BE5")
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class ListaValor(Base):
    __tablename__ = "lista_valores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    catalog: Mapped[str] = mapped_column(String(40), index=True)
    value: Mapped[str] = mapped_column(String(150))
    position: Mapped[int] = mapped_column(Integer, default=0)


class Persona(Base):
    __tablename__ = "personal"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # PER-001
    nombre: Mapped[str] = mapped_column(String(150), unique=True)
    puesto: Mapped[str] = mapped_column(String(120), default="")
    area: Mapped[str] = mapped_column(String(120), default="")
    legajo: Mapped[str] = mapped_column(String(60), default="")
    base: Mapped[str] = mapped_column(String(120), default="")
    francos_disponibles: Mapped[int] = mapped_column(Integer, default=0)
    francos_generados: Mapped[int] = mapped_column(Integer, default=0)
    notas: Mapped[str] = mapped_column(Text, default="")


class Ausencia(Base):
    __tablename__ = "ausencias"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # AUS-0001
    persona_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("personal.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(40))
    desde: Mapped[date] = mapped_column(Date)
    hasta: Mapped[date] = mapped_column(Date)
    notas: Mapped[str] = mapped_column(Text, default="")


class HistorialCambio(Base):
    __tablename__ = "historial_cambios"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # CH-0001
    proyecto_id: Mapped[str] = mapped_column(String(20), default="", index=True)
    campo: Mapped[str] = mapped_column(String(80))
    valor_anterior: Mapped[str] = mapped_column(Text, default="")
    valor_nuevo: Mapped[str] = mapped_column(Text, default="")
    usuario: Mapped[str] = mapped_column(String(120), default="")
    fecha_hora: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)