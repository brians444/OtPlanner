from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..core.websocket import notify
from ..crud.helpers import CATALOG_FIELD, key_of, norm
from ..crud.logic import rename_list_refs
from ..schemas import ListaCreate, ListaReorder, ListaUpdate, ListaValorResponse

router = APIRouter()


def _catalog_ok(catalog: str) -> None:
    if catalog not in CATALOG_FIELD:
        raise HTTPException(422, f"Catálogo desconocido: {catalog}")


def _dup(db: Session, catalog: str, value: str, except_id: int | None = None) -> bool:
    for v in db.execute(select(m.ListaValor).where(m.ListaValor.catalog == catalog)).scalars():
        if v.id != except_id and key_of(v.value) == key_of(value):
            return True
    return False


@router.post("", response_model=ListaValorResponse, status_code=201)
def create_value(data: ListaCreate, db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    _catalog_ok(data.catalog)
    if _dup(db, data.catalog, data.value):
        raise HTTPException(422, "Ese valor ya existe en la lista")
    mx = db.execute(select(m.ListaValor.position).where(
        m.ListaValor.catalog == data.catalog).order_by(m.ListaValor.position.desc())).first()
    v = m.ListaValor(catalog=data.catalog, value=norm(data.value),
                     position=(mx[0] + 1) if mx else 0)
    db.add(v)
    db.commit()
    db.refresh(v)
    notify()
    return v


@router.put("/{vid}", response_model=ListaValorResponse)
def update_value(vid: int, data: ListaUpdate, db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    v = db.get(m.ListaValor, vid)
    if not v:
        raise HTTPException(404, "Valor no encontrado")
    new = norm(data.value)
    if _dup(db, v.catalog, new, except_id=vid):
        raise HTTPException(422, "Ese valor ya existe en la lista")
    if key_of(v.value) != key_of(new):
        rename_list_refs(db, v.catalog, norm(v.value), new)
    v.value = new
    db.commit()
    db.refresh(v)
    notify()
    return v


@router.delete("/{vid}", status_code=204)
def delete_value(vid: int, db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    v = db.get(m.ListaValor, vid)
    if not v:
        raise HTTPException(404, "Valor no encontrado")
    rename_list_refs(db, v.catalog, norm(v.value), "")
    db.delete(v)
    db.commit()
    notify()


@router.post("/reorder", response_model=list[ListaValorResponse])
def reorder(data: ListaReorder, db: Session = Depends(get_db),
            u: m.User = Depends(get_current_active_user)):
    _catalog_ok(data.catalog)
    vals = {v.id: v for v in db.execute(select(m.ListaValor).where(
        m.ListaValor.catalog == data.catalog)).scalars()}
    for pos, vid in enumerate(data.ids):
        if vid in vals:
            vals[vid].position = pos
    db.commit()
    out = sorted(vals.values(), key=lambda v: (v.position, v.id))
    notify()
    return out