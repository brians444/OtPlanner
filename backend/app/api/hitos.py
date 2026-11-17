from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import next_id
from ..schemas import HitoCreate, HitoResponse, HitoUpdate

router = APIRouter()


@router.post("", response_model=HitoResponse, status_code=201)
def create_hito(data: HitoCreate, db: Session = Depends(get_db),
                u: m.User = Depends(get_current_active_user)):
    if not db.get(m.Proyecto, data.proyecto_id):
        raise HTTPException(404, "Proyecto no encontrado")
    h = m.Hito(id=next_id(db, m.Hito, "HITO-", 3), **data.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    notify()
    return h


@router.put("/{hid}", response_model=HitoResponse)
def update_hito(hid: str, data: HitoUpdate, db: Session = Depends(get_db),
                u: m.User = Depends(get_current_active_user)):
    h = db.get(m.Hito, hid)
    if not h:
        raise HTTPException(404, "Hito no encontrado")
    for f, v in data.model_dump(exclude_unset=True).items():
        setattr(h, f, v)
    db.commit()
    db.refresh(h)
    notify()
    return h


@router.delete("/{hid}", status_code=204)
def delete_hito(hid: str, db: Session = Depends(get_db),
                u: m.User = Depends(get_current_active_user)):
    h = db.get(m.Hito, hid)
    if not h:
        raise HTTPException(404, "Hito no encontrado")
    db.delete(h)
    db.commit()
    notify()