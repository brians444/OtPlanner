from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import key_of, next_id, norm
from ..crud.logic import remove_tag_refs, rename_tag_refs
from ..schemas import EtiquetaCreate, EtiquetaResponse, EtiquetaUpdate

router = APIRouter()


def _tag_exists(db: Session, name: str, except_id: str | None = None) -> bool:
    for t in db.execute(select(m.Etiqueta)).scalars():
        if t.id != except_id and key_of(t.etiqueta) == key_of(name):
            return True
    return False


@router.post("", response_model=EtiquetaResponse, status_code=201)
def create_tag(data: EtiquetaCreate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    if _tag_exists(db, data.etiqueta):
        raise HTTPException(422, "Ya existe esa etiqueta")
    t = m.Etiqueta(id=next_id(db, m.Etiqueta, "ET-", 2),
                   etiqueta=norm(data.etiqueta), categoria=data.categoria or "Otro",
                   color_hex=data.color_hex.replace("#", ""), activa=True)
    db.add(t)
    db.commit()
    db.refresh(t)
    notify()
    return t


@router.put("/{tid}", response_model=EtiquetaResponse)
def update_tag(tid: str, data: EtiquetaUpdate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    t = db.get(m.Etiqueta, tid)
    if not t:
        raise HTTPException(404, "Etiqueta no encontrada")
    payload = data.model_dump(exclude_unset=True)
    if "etiqueta" in payload:
        new = norm(payload["etiqueta"])
        if _tag_exists(db, new, except_id=tid):
            raise HTTPException(422, "Ya existe otra con ese nombre")
        old = norm(t.etiqueta)
        if old != new:
            rename_tag_refs(db, old, new)
        t.etiqueta = new
    if "categoria" in payload:
        t.categoria = payload["categoria"] or t.categoria
    if "color_hex" in payload:
        t.color_hex = payload["color_hex"].replace("#", "")
    if "activa" in payload:
        t.activa = payload["activa"]
    db.commit()
    db.refresh(t)
    notify()
    return t


@router.delete("/{tid}", status_code=204)
def delete_tag(tid: str, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    t = db.get(m.Etiqueta, tid)
    if not t:
        raise HTTPException(404, "Etiqueta no encontrada")
    remove_tag_refs(db, norm(t.etiqueta))
    db.delete(t)
    db.commit()
    notify()