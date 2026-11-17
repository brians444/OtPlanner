import re
import unicodedata
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m


def norm(s) -> str:
    return "" if s is None else str(s).strip()


def key_of(s) -> str:
    s = norm(s).lower()
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def next_id(db: Session, model, prefix: str, pad: int) -> str:
    pat = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    mx = 0
    for (val,) in db.execute(select(model.id)):
        mt = pat.match(norm(val))
        if mt:
            mx = max(mx, int(mt.group(1)))
    return f"{prefix}{mx + 1:0{pad}d}"


def estado_from_pct(pct: int) -> str:
    return "Completado" if pct >= 100 else "En progreso" if pct > 0 else "Pendiente"


def is_final_estado(name: str) -> bool:
    return key_of(name) == "completado"


def log_change(db: Session, pid: str, campo: str, antes, despues, usuario: str) -> None:
    def fmt(v):
        if v is None:
            return ""
        if isinstance(v, datetime):
            return v.strftime("%d/%m/%Y %H:%M")
        if isinstance(v, date):
            return v.strftime("%d/%m/%Y")
        if isinstance(v, bool):
            return "Si" if v else "No"
        return str(v)
    a, d = fmt(antes), fmt(despues)
    if norm(a) == norm(d):
        return
    db.add(m.HistorialCambio(
        id=next_id(db, m.HistorialCambio, "CH-", 4),
        proyecto_id=norm(pid), campo=campo,
        valor_anterior=a, valor_nuevo=d,
        usuario=usuario or "—", fecha_hora=datetime.now()))
    db.flush()


def acts_of(db: Session, pid: str) -> list[m.Actividad]:
    return list(db.execute(
        select(m.Actividad).where(m.Actividad.proyecto_id == pid)
        .order_by(m.Actividad.orden, m.Actividad.id)).scalars())


def checklist_of(db: Session, pid: str) -> list[m.ChecklistItem]:
    return list(db.execute(
        select(m.ChecklistItem).where(m.ChecklistItem.proyecto_id == pid)
        .order_by(m.ChecklistItem.orden, m.ChecklistItem.id)).scalars())


def subs_of(db: Session, aid: str) -> list[m.Subtarea]:
    return list(db.execute(
        select(m.Subtarea).where(m.Subtarea.actividad_id == aid)
        .order_by(m.Subtarea.orden, m.Subtarea.id)).scalars())


def checklist_stats(items) -> dict:
    total = len(items)
    done = sum(1 for i in items if i.hecha)
    return {"total": total, "done": done,
            "pct": round(done * 100 / total) if total else 0}


def is_checklist_mode(p: m.Proyecto) -> bool:
    return key_of(p.modo_tareas) == "checklist"


def duration_days(a: m.Actividad) -> int:
    if a.fecha_inicio and a.fecha_fin:
        return max((a.fecha_fin - a.fecha_inicio).days, 0)
    return 1


def touch(p: m.Proyecto) -> None:
    p.ultima_actualizacion = datetime.now()


def ensure_catalog(db: Session, catalog: str, value: str) -> None:
    value = norm(value)
    if not value:
        return
    exists = db.execute(select(m.ListaValor).where(
        m.ListaValor.catalog == catalog, m.ListaValor.value == value)).scalar_one_or_none()
    if exists:
        return
    mx = db.execute(select(m.ListaValor.position).where(
        m.ListaValor.catalog == catalog).order_by(m.ListaValor.position.desc())).first()
    db.add(m.ListaValor(catalog=catalog, value=value,
                        position=(mx[0] + 1) if mx else 0))


CATALOG_FIELD = {
    "Estado": "estado", "Prioridad": "prioridad", "Area": "area",
    "Sprint": "sprint", "Fase": "fase", "Responsable": "responsable",
    "Responsable_Tecnico": "responsable_tecnico", "Project_Leader": "project_leader",
    "Yacimiento": "yacimiento", "Instalacion": "instalacion",
}