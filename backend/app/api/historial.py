from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import norm
from ..schemas import HistorialResponse

router = APIRouter()


@router.get("", response_model=list[HistorialResponse])
def list_historial(proyecto_id: str = "", limit: int = 500,
                   db: Session = Depends(get_db),
                   u: m.User = Depends(get_current_active_user)):
    q = select(m.HistorialCambio)
    if norm(proyecto_id):
        q = q.where(m.HistorialCambio.proyecto_id == norm(proyecto_id))
    q = q.order_by(m.HistorialCambio.fecha_hora.desc(),
                   m.HistorialCambio.id.desc()).limit(max(1, min(limit, 5000)))
    return list(db.execute(q).scalars())


@router.delete("/{hid}", status_code=204)
def delete_entry(hid: str, db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    h = db.get(m.HistorialCambio, hid)
    if not h:
        raise HTTPException(404, "Registro no encontrado")
    db.delete(h)
    db.commit()
    notify()


@router.delete("", status_code=204)
def clear_historial(proyecto_id: str = "", db: Session = Depends(get_db),
                    u: m.User = Depends(get_current_active_user)):
    q = delete(m.HistorialCambio)
    if norm(proyecto_id):
        q = q.where(m.HistorialCambio.proyecto_id == norm(proyecto_id))
    db.execute(q)
    db.commit()
    notify()