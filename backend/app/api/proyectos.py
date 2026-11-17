from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import (ensure_catalog, is_final_estado, key_of, log_change,
                            next_id, norm, touch)
from ..crud.logic import (delete_project_cascade, duplicate_project,
                          recalc_all_acts, rollup_project, validate_act_dates)
from ..schemas import (EstadoPatch, NotesUpdate, ProyectoCreate,
                       ProyectoResponse, ProyectoUpdate)

router = APIRouter()

HIST_FIELDS = ["proyecto", "responsable", "responsable_tecnico", "project_leader",
               "area", "yacimiento", "instalacion", "estado", "prioridad", "sprint",
               "fase", "avance", "comentarios", "enlaces", "modo_tareas",
               "fecha_inicio", "fecha_fin_estimada"]


def _apply_etiquetas(p: m.Proyecto, etiquetas: list[str]) -> None:
    uniq = list(dict.fromkeys(t for t in etiquetas if norm(t)))[:5]
    for k in range(5):
        setattr(p, f"etiqueta_{k + 1}", uniq[k] if k < len(uniq) else "")


def _validate(p: m.Proyecto) -> None:
    if key_of(p.modo_tareas) == "checklist":
        p.fecha_inicio = None
        p.fecha_fin_estimada = None
    else:
        validate_act_dates(p.fecha_inicio, p.fecha_fin_estimada)
    if is_final_estado(p.estado):
        p.avance = 100


def _ensure_catalogs(db: Session, p: m.Proyecto) -> None:
    ensure_catalog(db, "Responsable", p.responsable)
    ensure_catalog(db, "Responsable_Tecnico", p.responsable_tecnico)
    ensure_catalog(db, "Project_Leader", p.project_leader)
    ensure_catalog(db, "Yacimiento", p.yacimiento)
    ensure_catalog(db, "Instalacion", p.instalacion)


@router.post("", response_model=ProyectoResponse, status_code=201)
def create_proyecto(data: ProyectoCreate, db: Session = Depends(get_db),
                    u: m.User = Depends(get_current_active_user)):
    p = m.Proyecto(id=next_id(db, m.Proyecto, "PRY-", 3),
                   **data.model_dump(exclude={"etiquetas"}))
    _apply_etiquetas(p, data.etiquetas)
    _validate(p)
    _ensure_catalogs(db, p)
    touch(p)
    db.add(p)
    db.flush()
    rollup_project(db, p)
    log_change(db, p.id, "Proyecto creado", "",
               f"{p.proyecto} [{p.modo_tareas}]", u.display_name or u.username)
    db.commit()
    db.refresh(p)
    notify()
    return p


@router.put("/{pid}", response_model=ProyectoResponse)
def update_proyecto(pid: str, data: ProyectoUpdate, db: Session = Depends(get_db),
                    u: m.User = Depends(get_current_active_user)):
    p = db.get(m.Proyecto, pid)
    if not p:
        raise HTTPException(404, "Proyecto no encontrado")
    before = {f: getattr(p, f) for f in HIST_FIELDS}
    payload = data.model_dump(exclude_unset=True, exclude={"etiquetas"})
    for f, v in payload.items():
        setattr(p, f, v)
    if data.etiquetas is not None:
        _apply_etiquetas(p, data.etiquetas)
    _validate(p)
    _ensure_catalogs(db, p)
    for f in HIST_FIELDS:
        log_change(db, p.id, f, before[f], getattr(p, f), u.display_name or u.username)
    rollup_project(db, p)
    touch(p)
    db.commit()
    db.refresh(p)
    notify()
    return p


@router.patch("/{pid}/estado", response_model=ProyectoResponse)
def change_estado(pid: str, data: EstadoPatch, db: Session = Depends(get_db),
                  u: m.User = Depends(get_current_active_user)):
    p = db.get(m.Proyecto, pid)
    if not p:
        raise HTTPException(404, "Proyecto no encontrado")
    if key_of(p.estado) == key_of(data.estado):
        return p
    log_change(db, p.id, "estado", p.estado, data.estado, u.display_name or u.username)
    p.estado = data.estado
    if is_final_estado(data.estado):
        p.avance = 100
    touch(p)
    db.commit()
    db.refresh(p)
    notify()
    return p


@router.put("/{pid}/notes", response_model=ProyectoResponse)
def update_notes(pid: str, data: NotesUpdate, db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    p = db.get(m.Proyecto, pid)
    if not p:
        raise HTTPException(404, "Proyecto no encontrado")
    uname = u.display_name or u.username
    log_change(db, pid, "comentarios", p.comentarios, data.comentarios, uname)
    log_change(db, pid, "enlaces", p.enlaces, data.enlaces, uname)
    p.comentarios = data.comentarios
    p.enlaces = data.enlaces
    touch(p)
    db.commit()
    db.refresh(p)
    notify()
    return p


@router.post("/{pid}/duplicate", response_model=ProyectoResponse, status_code=201)
def duplicate(pid: str, db: Session = Depends(get_db),
              u: m.User = Depends(get_current_active_user)):
    src = db.get(m.Proyecto, pid)
    if not src:
        raise HTTPException(404, "Proyecto no encontrado")
    copy = duplicate_project(db, src, u.display_name or u.username)
    db.commit()
    db.refresh(copy)
    notify()
    return copy


@router.post("/{pid}/recalc-acts")
def recalc_acts(pid: str, db: Session = Depends(get_db),
                u: m.User = Depends(get_current_active_user)):
    changed = recalc_all_acts(db, pid)
    db.commit()
    notify()
    return {"changed": changed}


@router.delete("/{pid}", status_code=204)
def delete_proyecto(pid: str, db: Session = Depends(get_db),
                    u: m.User = Depends(get_current_active_user)):
    delete_project_cascade(db, pid, u.display_name or u.username)
    db.commit()
    notify()