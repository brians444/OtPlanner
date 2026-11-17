from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user
from ..schemas import Snapshot

router = APIRouter()


@router.get("", response_model=Snapshot)
def snapshot(db: Session = Depends(get_db),
             u: m.User = Depends(get_current_active_user)):
    def all_of(model, *order):
        q = select(model)
        if order:
            q = q.order_by(*order)
        return list(db.execute(q).scalars())

    return Snapshot(
        proyectos=all_of(m.Proyecto, m.Proyecto.id),
        actividades=all_of(m.Actividad, m.Actividad.proyecto_id,
                           m.Actividad.orden, m.Actividad.id),
        comentarios=all_of(m.Comentario, m.Comentario.id),
        subtareas=all_of(m.Subtarea, m.Subtarea.actividad_id, m.Subtarea.orden),
        checklist=all_of(m.ChecklistItem, m.ChecklistItem.proyecto_id,
                         m.ChecklistItem.orden),
        hitos=all_of(m.Hito, m.Hito.id),
        etiquetas=all_of(m.Etiqueta, m.Etiqueta.id),
        listas=all_of(m.ListaValor, m.ListaValor.catalog, m.ListaValor.position),
        personal=all_of(m.Persona, m.Persona.nombre),
        ausencias=all_of(m.Ausencia, m.Ausencia.id),
        historial=all_of(m.HistorialCambio, m.HistorialCambio.fecha_hora.desc(),
                         m.HistorialCambio.id.desc()),
    )