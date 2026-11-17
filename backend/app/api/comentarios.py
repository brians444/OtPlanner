from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import next_id, norm
from ..schemas import (ComentarioCreate, ComentarioResponse, ComentarioUpdate)

router = APIRouter()


@router.post("", response_model=ComentarioResponse, status_code=201)
def create_com(data: ComentarioCreate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    aid, pid = norm(data.actividad_id), norm(data.proyecto_id)
    if aid:
        a = db.get(m.Actividad, aid)
        if not a:
            raise HTTPException(404, "Actividad no encontrada")
        pid = a.proyecto_id
    elif pid:
        if not db.get(m.Proyecto, pid):
            raise HTTPException(404, "Proyecto no encontrado")
    else:
        raise HTTPException(422, "Falta actividad_id o proyecto_id")
    c = m.Comentario(id=next_id(db, m.Comentario, "COM-", 3),
                     actividad_id=aid, proyecto_id=pid,
                     autor=norm(data.autor) or (u.display_name or u.username),
                     fecha_hora=datetime.now(), comentario=data.comentario)
    db.add(c)
    db.commit()
    db.refresh(c)
    notify()
    return c


@router.put("/{cid}", response_model=ComentarioResponse)
def update_com(cid: str, data: ComentarioUpdate, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    c = db.get(m.Comentario, cid)
    if not c:
        raise HTTPException(404, "Comentario no encontrado")
    c.comentario = data.comentario
    c.fecha_hora = datetime.now()
    db.commit()
    db.refresh(c)
    notify()
    return c


@router.delete("/{cid}", status_code=204)
def delete_com(cid: str, db: Session = Depends(get_db),
               u: m.User = Depends(get_current_active_user)):
    c = db.get(m.Comentario, cid)
    if not c:
        raise HTTPException(404, "Comentario no encontrado")
    db.delete(c)
    db.commit()
    notify()