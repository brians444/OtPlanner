"""Importación de Excel (demo.xlsx o export de la app) a la base. También usado por el seed."""
import re
from datetime import date, datetime, timedelta

import openpyxl
from sqlalchemy import delete
from sqlalchemy.orm import Session

from .. import models as m
from ..crud.helpers import key_of, norm

SHEETS = ["Proyectos", "Actividades", "Etiquetas", "Listas", "Comentarios_Act",
          "Historial_Cambios", "Subtareas", "Hitos", "Personal", "Ausencias",
          "Checklist_Proyecto"]


def find_sheet(wb, prefix: str):
    for n in wb.sheetnames:
        if n.lower().startswith(prefix.lower()):
            return wb[n]
    return None


def rows_of(ws) -> list[dict]:
    if ws is None:
        return []
    it = ws.iter_rows(values_only=True)
    try:
        header = [norm(h) for h in next(it)]
    except StopIteration:
        return []
    out = []
    for row in it:
        d = {header[i]: row[i] if i < len(row) else None
             for i in range(len(header)) if header[i]}
        if any(norm(v) for v in d.values()):
            out.append(d)
    return out


def to_date(v) -> date | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)):
        try:
            return date(1899, 12, 30) + timedelta(days=int(v))
        except (OverflowError, ValueError):
            return None
    s = norm(v)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        return None


def to_dt(v) -> datetime | None:
    if isinstance(v, datetime):
        return v
    d = to_date(v)
    return datetime(d.year, d.month, d.day) if d else None


def to_bool(v) -> bool:
    return key_of(v) in ("si", "true", "1", "x", "yes")


def to_int(v, default=0) -> int:
    try:
        return int(float(norm(v).replace(",", ".")))
    except (ValueError, TypeError):
        return default


def to_float(v):
    try:
        f = float(norm(v).replace(",", "."))
        return f if f > 0 else None
    except (ValueError, TypeError):
        return None


def clean_text(v) -> str:
    return norm(v).replace("_x000d_", "").replace("_x000D_", "")


def import_workbook(db: Session, wb, replace: bool = True) -> dict:
    """Carga las hojas gestionadas por la app. replace=True borra los datos previos."""
    counts = {}
    if replace:
        for model in (m.Comentario, m.Subtarea, m.ChecklistItem, m.Hito,
                      m.Actividad, m.Ausencia, m.Persona, m.Etiqueta,
                      m.ListaValor, m.HistorialCambio, m.Proyecto):
            db.execute(delete(model))
        db.flush()

    def add(model, rows, pk, builder, required):
        n = 0
        seen = set()
        for r in rows:
            ident = norm(r.get(pk))
            if not ident or ident in seen or not norm(r.get(required)):
                continue
            seen.add(ident)
            db.add(builder(ident, r))
            n += 1
        db.flush()
        counts[model.__tablename__] = n

    add(m.Proyecto, rows_of(find_sheet(wb, "proyecto")), "ID_Proyecto",
        lambda i, r: m.Proyecto(
            id=i, proyecto=clean_text(r.get("Proyecto")),
            descripcion=clean_text(r.get("Descripcion")),
            responsable=clean_text(r.get("Responsable")),
            responsable_tecnico=clean_text(r.get("Responsable_Tecnico")),
            project_leader=clean_text(r.get("Project_Leader")),
            area=clean_text(r.get("Area")), yacimiento=clean_text(r.get("Yacimiento")),
            instalacion=clean_text(r.get("Instalacion")),
            estado=clean_text(r.get("Estado")) or "Pendiente",
            prioridad=clean_text(r.get("Prioridad")) or "Media",
            fecha_inicio=to_date(r.get("Fecha_Inicio")),
            fecha_fin_estimada=to_date(r.get("Fecha_Fin_Estimada")),
            avance=max(0, min(100, to_int(r.get("Avance_%")))),
            sprint=clean_text(r.get("Sprint")), fase=clean_text(r.get("Fase")),
            etiqueta_1=clean_text(r.get("Etiqueta_1")), etiqueta_2=clean_text(r.get("Etiqueta_2")),
            etiqueta_3=clean_text(r.get("Etiqueta_3")), etiqueta_4=clean_text(r.get("Etiqueta_4")),
            etiqueta_5=clean_text(r.get("Etiqueta_5")),
            comentarios=clean_text(r.get("Comentarios")),
            ultima_actualizacion=to_dt(r.get("Ultima_Actualizacion")),
            enlaces=clean_text(r.get("Enlaces")),
            modo_tareas=clean_text(r.get("Modo_Tareas")) or "Gantt"),
        "Proyecto")

    acts = rows_of(find_sheet(wb, "actividad"))
    n = 0
    for k, r in enumerate(acts):
        i = norm(r.get("ID_Actividad"))
        if not i or not norm(r.get("Actividad")):
            continue
        db.add(m.Actividad(
            id=i, proyecto_id=norm(r.get("ID_Proyecto")),
            actividad=clean_text(r.get("Actividad")),
            fecha_inicio=to_date(r.get("Fecha_Inicio")), fecha_fin=to_date(r.get("Fecha_Fin")),
            avance=max(0, min(100, to_int(r.get("Avance_%")))),
            etiqueta=clean_text(r.get("Etiqueta")),
            estado=clean_text(r.get("Estado")) or "Pendiente",
            depende_de=norm(r.get("Depende_De")),
            peso=to_float(r.get("Peso")) or 1.0, orden=k))
        n += 1
    db.flush()
    counts["actividades"] = n

    add(m.Etiqueta, rows_of(find_sheet(wb, "etiqueta")), "ID_Etiqueta",
        lambda i, r: m.Etiqueta(
            id=i, etiqueta=clean_text(r.get("Etiqueta")),
            categoria=clean_text(r.get("Categoria")) or "Otro",
            color_hex=norm(r.get("Color_Hex")).replace("#", "") or "2C7BE5",
            activa=key_of(r.get("Activa")) != "no"),
        "Etiqueta")

    lis = rows_of(find_sheet(wb, "lista"))
    catalogs = ["Estado", "Prioridad", "Area", "Sprint", "Fase", "Responsable",
                "Responsable_Tecnico", "Project_Leader", "Yacimiento", "Instalacion"]
    n = 0
    for cat in catalogs:
        pos = 0
        seen = set()
        for r in lis:
            v = clean_text(r.get(cat))
            if v and key_of(v) not in seen:
                seen.add(key_of(v))
                db.add(m.ListaValor(catalog=cat, value=v, position=pos))
                pos += 1
                n += 1
    db.flush()
    counts["lista_valores"] = n

    add(m.Comentario, rows_of(find_sheet(wb, "comentarios_act")), "ID_Comentario",
        lambda i, r: m.Comentario(
            id=i, actividad_id=norm(r.get("ID_Actividad")),
            proyecto_id=norm(r.get("ID_Proyecto")), autor=clean_text(r.get("Autor")),
            fecha_hora=to_dt(r.get("Fecha_Hora")) or datetime.now(),
            comentario=clean_text(r.get("Comentario"))),
        "Comentario")

    add(m.HistorialCambio, rows_of(find_sheet(wb, "historial")), "ID_Cambio",
        lambda i, r: m.HistorialCambio(
            id=i, proyecto_id=norm(r.get("ID_Proyecto")),
            campo=clean_text(r.get("Campo_Modificado")),
            valor_anterior=clean_text(r.get("Valor_Anterior")),
            valor_nuevo=clean_text(r.get("Valor_Nuevo")),
            usuario=clean_text(r.get("Usuario")),
            fecha_hora=to_dt(r.get("Fecha_Hora")) or datetime.now()),
        "Campo_Modificado")

    add(m.Subtarea, rows_of(find_sheet(wb, "subtarea")), "ID_Subtarea",
        lambda i, r: m.Subtarea(
            id=i, actividad_id=norm(r.get("ID_Actividad")),
            proyecto_id=norm(r.get("ID_Proyecto")), texto=clean_text(r.get("Texto")),
            hecha=to_bool(r.get("Hecha")), orden=to_int(r.get("Orden")),
            horas_est=to_float(r.get("Horas_Est")),
            demanda=clean_text(r.get("Demanda")) or "Media"),
        "Texto")

    add(m.Hito, rows_of(find_sheet(wb, "hito")), "ID_Hito",
        lambda i, r: m.Hito(
            id=i, proyecto_id=norm(r.get("ID_Proyecto")), hito=clean_text(r.get("Hito")),
            fecha=to_date(r.get("Fecha")), estado=clean_text(r.get("Estado")) or "Pendiente"),
        "Hito")

    add(m.Persona, rows_of(find_sheet(wb, "personal")), "ID_Persona",
        lambda i, r: m.Persona(
            id=i, nombre=clean_text(r.get("Nombre")), puesto=clean_text(r.get("Puesto")),
            area=clean_text(r.get("Area")), legajo=clean_text(r.get("Legajo")),
            base=clean_text(r.get("Base")),
            francos_disponibles=to_int(r.get("Francos_Disponibles")),
            francos_generados=to_int(r.get("Francos_Generados")),
            notas=clean_text(r.get("Notas"))),
        "Nombre")

    add(m.Ausencia, rows_of(find_sheet(wb, "ausencia")), "ID_Ausencia",
        lambda i, r: m.Ausencia(
            id=i, persona_id=norm(r.get("ID_Persona")),
            tipo=clean_text(r.get("Tipo")) or "Vacaciones",
            desde=to_date(r.get("Desde")) or date.today(),
            hasta=to_date(r.get("Hasta")) or date.today(),
            notas=clean_text(r.get("Notas"))),
        "ID_Persona")

    add(m.ChecklistItem, rows_of(find_sheet(wb, "checklist")), "ID_ItemCK",
        lambda i, r: m.ChecklistItem(
            id=i, proyecto_id=norm(r.get("ID_Proyecto")), texto=clean_text(r.get("Texto")),
            hecha=to_bool(r.get("Hecha")), orden=to_int(r.get("Orden")),
            horas_est=to_float(r.get("Horas_Est")),
            demanda=clean_text(r.get("Demanda")) or "Media"),
        "Texto")
    return counts