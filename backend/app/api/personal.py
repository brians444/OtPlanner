from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import key_of, next_id, norm
from ..schemas import (AusenciaCreate, AusenciaResponse, PersonaCreate,
                       PersonaResponse, PersonaUpdate)

router = APIRouter()

AUS_TIPOS = ("Vacaciones", "Trámite", "Franco", "Franco Generado")


@router.get("", response_model=list[PersonaResponse])
def list_personas(db: Session = Depends(get_db),
                  u: m.User = Depends(get_current_active_user)):
    return list(db.execute(select(m.Persona).order_by(m.Persona.nombre)).scalars())


@router.post("", response_model=PersonaResponse, status_code=201)
def create_persona(data: PersonaCreate, db: Session = Depends(get_db),
                   u: m.User = Depends(get_current_active_user)):
    name = norm(data.nombre)
    for p in db.execute(select(m.Persona)).scalars():
        if key_of(p.nombre) == key_of(name):
            raise HTTPException(422, "Ya existe una persona con ese nombre")
    p = m.Persona(id=next_id(db, m.Persona, "PER-", 3), nombre=name)
    db.add(p)
    db.commit()
    db.refresh(p)
    notify()
    return p


@router.put("/{pid}", response_model=PersonaResponse)
def update_persona(pid: str, data: PersonaUpdate, db: Session = Depends(get_db),
                   u: m.User = Depends(get_current_active_user)):
    p = db.get(m.Persona, pid)
    if not p:
        raise HTTPException(404, "Persona no encontrada")
    payload = data.model_dump(exclude_unset=True)
    if "nombre" in payload:
        new = norm(payload.pop("nombre"))
        for other in db.execute(select(m.Persona)).scalars():
            if other.id != pid and key_of(other.nombre) == key_of(new):
                raise HTTPException(422, "Ya existe otra persona con ese nombre")
        p.nombre = new
    for f, v in payload.items():
        setattr(p, f, v if v is not None else "")
    db.commit()
    db.refresh(p)
    notify()
    return p


@router.delete("/{pid}", status_code=204)
def delete_persona(pid: str, db: Session = Depends(get_db),
                   u: m.User = Depends(get_current_active_user)):
    p = db.get(m.Persona, pid)
    if not p:
        raise HTTPException(404, "Persona no encontrada")
    db.delete(p)
    db.flush()
    from sqlalchemy import delete as sa_delete
    db.execute(sa_delete(m.Ausencia).where(m.Ausencia.persona_id == pid))
    db.commit()
    notify()


# ---------- Ausencias ----------
aus_router = APIRouter()


@aus_router.post("", response_model=AusenciaResponse, status_code=201)
def create_ausencia(data: AusenciaCreate, db: Session = Depends(get_db),
                    u: m.User = Depends(get_current_active_user)):
    if not db.get(m.Persona, data.persona_id):
        raise HTTPException(404, "Persona no encontrada")
    if data.hasta < data.desde:
        raise HTTPException(422, "La fecha 'hasta' no puede ser anterior a 'desde'")
    if not any(key_of(t) == key_of(data.tipo) for t in AUS_TIPOS):
        raise HTTPException(422, "Tipo de ausencia inválido")
    a = m.Ausencia(id=next_id(db, m.Ausencia, "AUS-", 4), **data.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    notify()
    return a


@aus_router.delete("/{aid}", status_code=204)
def delete_ausencia(aid: str, db: Session = Depends(get_db),
                    u: m.User = Depends(get_current_active_user)):
    a = db.get(m.Ausencia, aid)
    if not a:
        raise HTTPException(404, "Ausencia no encontrada")
    db.delete(a)
    db.commit()
    notify()