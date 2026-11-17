from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import acts_of, estado_from_pct, next_id, norm, touch
from ..crud.logic import (MAX_ACTS, apply_sub_pct, cascade, enforce_pred_start,
                          has_cycle, rollup_project, set_act_done,
                          validate_act_dates)
from ..schemas import (ActividadCreate, ActividadResponse, ActividadUpdate,
                       MoveRequest, ReorderRequest)
from pydantic import BaseModel

router = APIRouter()


class DoneRequest(BaseModel):
    done: bool


def _rollup_touch(db: Session, pid: str) -> None:
    p = db.get(m.Proyecto, pid)
    if p:
        rollup_project(db, p)
        touch(p)


def _check_dep(db: Session, aid: str | None, dep: str) -> None:
    if not dep:
        return
    if not db.get(m.Actividad, dep):
        raise HTTPException(422, "La actividad predecesora no existe")
    if aid and has_cycle(db, aid, dep):
        raise HTTPException(422, "Esa dependencia genera un ciclo")


@router.post("", response_model=ActividadResponse, status_code=201)
def create_act(data: ActividadCreate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    p = db.get(m.Proyecto, data.proyecto_id)
    if not p:
        raise HTTPException(404, "Proyecto no encontrado")
    if len(acts_of(db, p.id)) >= MAX_ACTS:
        raise HTTPException(422, f"Máximo {MAX_ACTS} actividades por proyecto")
    validate_act_dates(data.fecha_inicio, data.fecha_fin)
    _check_dep(db, None, data.depende_de)
    mx = db.execute(select(m.Actividad.orden).where(
        m.Actividad.proyecto_id == p.id).order_by(m.Actividad.orden.desc())).first()
    a = m.Actividad(id=next_id(db, m.Actividad, "ACT-", 3),
                    estado=estado_from_pct(data.avance),
                    orden=(mx[0] + 1) if mx else 0,
                    **data.model_dump())
    db.add(a)
    db.flush()
    enforce_pred_start(db, a)
    cascade(db, a.id)
    _rollup_touch(db, p.id)
    db.commit()
    db.refresh(a)
    notify()
    return a


@router.put("/{aid}", response_model=ActividadResponse)
def update_act(aid: str, data: ActividadUpdate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    a = db.get(m.Actividad, aid)
    if not a:
        raise HTTPException(404, "Actividad no encontrada")
    payload = data.model_dump(exclude_unset=True)
    ini = payload.get("fecha_inicio", a.fecha_inicio)
    fin = payload.get("fecha_fin", a.fecha_fin)
    validate_act_dates(ini, fin)
    if "depende_de" in payload:
        _check_dep(db, aid, payload["depende_de"])
    for f, v in payload.items():
        setattr(a, f, v)
    if "avance" in payload:
        a.estado = estado_from_pct(a.avance)
    enforce_pred_start(db, a)
    cascade(db, a.id)
    _rollup_touch(db, a.proyecto_id)
    db.commit()
    db.refresh(a)
    notify()
    return a


@router.post("/{aid}/move")
def move_act(aid: str, data: MoveRequest, db: Session = Depends(get_db),
             u: m.User = Depends(get_current_active_user)):
    a = db.get(m.Actividad, aid)
    if not a:
        raise HTTPException(404, "Actividad no encontrada")
    if not a.fecha_inicio or not a.fecha_fin:
        raise HTTPException(422, "La actividad no tiene fechas para mover")
    delta = timedelta(days=data.delta_days)
    a.fecha_inicio += delta
    a.fecha_fin += delta
    enforce_pred_start(db, a)
    moved = cascade(db, a.id)
    _rollup_touch(db, a.proyecto_id)
    db.commit()
    db.refresh(a)
    notify()
    return {"actividad": a, "cascaded": moved}


@router.post("/reorder")
def reorder_acts(data: ReorderRequest, db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    for pos, aid in enumerate(data.ids):
        a = db.get(m.Actividad, aid)
        if a:
            a.orden = pos
    db.commit()
    notify()
    return {"ok": True}


@router.post("/{aid}/done", response_model=ActividadResponse)
def mark_done(aid: str, data: DoneRequest, db: Session = Depends(get_db),
              u: m.User = Depends(get_current_active_user)):
    a = set_act_done(db, aid, data.done)
    db.commit()
    db.refresh(a)
    notify()
    return a


@router.post("/{aid}/apply-checklist", response_model=ActividadResponse)
def apply_checklist(aid: str, db: Session = Depends(get_db),
                    u: m.User = Depends(get_current_active_user)):
    a = apply_sub_pct(db, aid)
    db.commit()
    db.refresh(a)
    notify()
    return a


@router.delete("/{aid}", status_code=204)
def delete_act(aid: str, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    a = db.get(m.Actividad, aid)
    if not a:
        raise HTTPException(404, "Actividad no encontrada")
    pid = a.proyecto_id
    for succ in db.execute(select(m.Actividad).where(
            m.Actividad.depende_de == aid)).scalars():
        succ.depende_de = ""
    db.execute(delete(m.Comentario).where(m.Comentario.actividad_id == aid))
    db.execute(delete(m.Subtarea).where(m.Subtarea.actividad_id == aid))
    db.delete(a)
    db.flush()
    _rollup_touch(db, pid)
    db.commit()
    notify()