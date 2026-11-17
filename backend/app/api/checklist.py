from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import checklist_of, next_id, subs_of, touch
from ..crud.logic import rollup_project
from ..schemas import (ChecklistCreate, ChecklistItemResponse, ItemUpdate,
                       ReorderRequest, SubtareaCreate, SubtareaResponse)

router = APIRouter()
sub_router = APIRouter()

DEMANDAS = ("Alta", "Media", "Baja")


def _dem(d: str | None) -> str:
    return d if d in DEMANDAS else "Media"


def _rollup(db: Session, pid: str) -> None:
    p = db.get(m.Proyecto, pid)
    if p:
        rollup_project(db, p)
        touch(p)


# ---------- Checklist de proyecto ----------
@router.post("", response_model=ChecklistItemResponse, status_code=201)
def create_item(data: ChecklistCreate, db: Session = Depends(get_db),
                u: m.User = Depends(get_current_active_user)):
    if not db.get(m.Proyecto, data.proyecto_id):
        raise HTTPException(404, "Proyecto no encontrado")
    mx = max((c.orden for c in checklist_of(db, data.proyecto_id)), default=0)
    it = m.ChecklistItem(id=next_id(db, m.ChecklistItem, "CHK-", 4),
                         proyecto_id=data.proyecto_id, texto=data.texto,
                         hecha=False, orden=mx + 1,
                         horas_est=data.horas_est or None, demanda=_dem(data.demanda))
    db.add(it)
    db.flush()
    _rollup(db, it.proyecto_id)
    db.commit()
    db.refresh(it)
    notify()
    return it


@router.put("/{iid}", response_model=ChecklistItemResponse)
def update_item(iid: str, data: ItemUpdate, db: Session = Depends(get_db),
                u: m.User = Depends(get_current_active_user)):
    it = db.get(m.ChecklistItem, iid)
    if not it:
        raise HTTPException(404, "Ítem no encontrado")
    payload = data.model_dump(exclude_unset=True)
    if "demanda" in payload:
        payload["demanda"] = _dem(payload["demanda"])
    if "horas_est" in payload:
        payload["horas_est"] = payload["horas_est"] or None
    for f, v in payload.items():
        setattr(it, f, v)
    _rollup(db, it.proyecto_id)
    db.commit()
    db.refresh(it)
    notify()
    return it


@router.post("/reorder")
def reorder_items(data: ReorderRequest, db: Session = Depends(get_db),
                  u: m.User = Depends(get_current_active_user)):
    for pos, iid in enumerate(data.ids):
        it = db.get(m.ChecklistItem, iid)
        if it:
            it.orden = pos + 1
    db.commit()
    notify()
    return {"ok": True}


@router.delete("/{iid}", status_code=204)
def delete_item(iid: str, db: Session = Depends(get_db),
                u: m.User = Depends(get_current_active_user)):
    it = db.get(m.ChecklistItem, iid)
    if not it:
        raise HTTPException(404, "Ítem no encontrado")
    pid = it.proyecto_id
    db.delete(it)
    db.flush()
    _rollup(db, pid)
    db.commit()
    notify()


# ---------- Subtareas de actividad ----------
@sub_router.post("", response_model=SubtareaResponse, status_code=201)
def create_sub(data: SubtareaCreate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    a = db.get(m.Actividad, data.actividad_id)
    if not a:
        raise HTTPException(404, "Actividad no encontrada")
    ordn = len(subs_of(db, a.id)) + 1
    it = m.Subtarea(id=next_id(db, m.Subtarea, "SUB-", 3),
                    actividad_id=a.id, proyecto_id=a.proyecto_id, texto=data.texto,
                    hecha=False, orden=ordn,
                    horas_est=data.horas_est or None, demanda=_dem(data.demanda))
    db.add(it)
    db.commit()
    db.refresh(it)
    notify()
    return it


@sub_router.put("/{sid}", response_model=SubtareaResponse)
def update_sub(sid: str, data: ItemUpdate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    it = db.get(m.Subtarea, sid)
    if not it:
        raise HTTPException(404, "Subtarea no encontrada")
    payload = data.model_dump(exclude_unset=True)
    if "demanda" in payload:
        payload["demanda"] = _dem(payload["demanda"])
    if "horas_est" in payload:
        payload["horas_est"] = payload["horas_est"] or None
    for f, v in payload.items():
        setattr(it, f, v)
    db.commit()
    db.refresh(it)
    notify()
    return it


@sub_router.post("/reorder")
def reorder_subs(data: ReorderRequest, db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    for pos, sid in enumerate(data.ids):
        it = db.get(m.Subtarea, sid)
        if it:
            it.orden = pos + 1
    db.commit()
    notify()
    return {"ok": True}


@sub_router.delete("/{sid}", status_code=204)
def delete_sub(sid: str, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    it = db.get(m.Subtarea, sid)
    if not it:
        raise HTTPException(404, "Subtarea no encontrada")
    db.delete(it)
    db.commit()
    notify()