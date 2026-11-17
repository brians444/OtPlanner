from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import models as m
from .helpers import (acts_of, checklist_of, checklist_stats, duration_days,
                      ensure_catalog, is_checklist_mode, is_final_estado,
                      key_of, log_change, next_id, norm, subs_of, touch)

MAX_ACTS = 10


def rollup_project(db: Session, p: m.Proyecto) -> None:
    """Recalcula avance/fechas/estado del proyecto desde sus tareas."""
    if is_checklist_mode(p):
        st = checklist_stats(checklist_of(db, p.id))
        p.avance = st["pct"]
        if st["total"] and st["done"] == st["total"] and key_of(p.estado) != "cancelado":
            p.estado = "Completado"
        return
    acts = acts_of(db, p.id)
    if not acts:
        return
    sw = sp = 0.0
    for a in acts:
        w = max(a.peso or 1.0, 0.0)
        sw += w
        sp += w * (a.avance or 0)
    p.avance = round(sp / sw) if sw else round(sum(a.avance or 0 for a in acts) / len(acts))
    inis = [a.fecha_inicio for a in acts if a.fecha_inicio]
    fins = [a.fecha_fin for a in acts if a.fecha_fin]
    if inis:
        p.fecha_inicio = min(inis)
    if fins:
        p.fecha_fin_estimada = max(fins)
    if p.avance == 100 and key_of(p.estado) != "cancelado":
        p.estado = "Completado"


def has_cycle(db: Session, act_id: str, dep_id: str) -> bool:
    cur, guard = dep_id, 0
    while cur and guard < 500:
        guard += 1
        if norm(cur) == norm(act_id):
            return True
        pred = db.get(m.Actividad, cur)
        cur = norm(pred.depende_de) if pred else ""
    return False


def cascade(db: Session, act_id: str) -> int:
    """Reprograma sucesores fin-a-inicio; devuelve cuántos movió."""
    moved, guard = 0, 0
    queue = [act_id]
    while queue and guard < 1000:
        guard += 1
        cur = queue.pop(0)
        pred = db.get(m.Actividad, cur)
        if not pred or not pred.fecha_fin:
            continue
        min_start = pred.fecha_fin + timedelta(days=1)
        succs = list(db.execute(select(m.Actividad).where(
            m.Actividad.depende_de == cur)).scalars())
        for suc in succs:
            dur = duration_days(suc)
            if not suc.fecha_inicio or suc.fecha_inicio < min_start:
                suc.fecha_inicio = min_start
                suc.fecha_fin = min_start + timedelta(days=dur)
                moved += 1
                queue.append(suc.id)
    return moved


def validate_act_dates(ini: date | None, fin: date | None) -> None:
    if ini and fin and fin < ini:
        raise HTTPException(422, "La fecha fin no puede ser anterior al inicio")


def enforce_pred_start(db: Session, a: m.Actividad) -> None:
    """Si tiene predecesor, el inicio no puede ser anterior a su fin + 1."""
    if not a.depende_de:
        return
    pred = db.get(m.Actividad, a.depende_de)
    if not pred or not pred.fecha_fin:
        return
    min_start = pred.fecha_fin + timedelta(days=1)
    if not a.fecha_inicio or a.fecha_inicio < min_start:
        dur = duration_days(a) if (a.fecha_inicio and a.fecha_fin) else 7
        a.fecha_inicio = min_start
        a.fecha_fin = min_start + timedelta(days=dur)


def duplicate_project(db: Session, src: m.Proyecto, usuario: str) -> m.Proyecto:
    new_pid = next_id(db, m.Proyecto, "PRY-", 3)
    copy = m.Proyecto(
        id=new_pid, proyecto=norm(src.proyecto) + " (copia)",
        descripcion=src.descripcion, responsable=src.responsable,
        responsable_tecnico=src.responsable_tecnico, project_leader=src.project_leader,
        area=src.area, yacimiento=src.yacimiento, instalacion=src.instalacion,
        estado=src.estado, prioridad=src.prioridad,
        fecha_inicio=src.fecha_inicio, fecha_fin_estimada=src.fecha_fin_estimada,
        avance=src.avance, sprint=src.sprint, fase=src.fase,
        etiqueta_1=src.etiqueta_1, etiqueta_2=src.etiqueta_2, etiqueta_3=src.etiqueta_3,
        etiqueta_4=src.etiqueta_4, etiqueta_5=src.etiqueta_5,
        comentarios=src.comentarios, enlaces=src.enlaces, modo_tareas=src.modo_tareas)
    db.add(copy)
    db.flush()
    src_acts = acts_of(db, src.id)
    id_map = {}
    if src_acts:
        first = next_id(db, m.Actividad, "ACT-", 3)
        base_num = int(first[len("ACT-"):])
        for k, a in enumerate(src_acts):
            id_map[a.id] = f"ACT-{base_num + k:03d}"
    base_orden = max((a.orden for a in src_acts), default=0)
    for k, a in enumerate(src_acts):
        na = m.Actividad(
            id=id_map[a.id], proyecto_id=new_pid, actividad=a.actividad,
            fecha_inicio=a.fecha_inicio, fecha_fin=a.fecha_fin, avance=a.avance,
            etiqueta=a.etiqueta, estado=a.estado,
            depende_de=id_map.get(norm(a.depende_de), ""),
            peso=a.peso, orden=base_orden + k + 1)
        db.add(na)
    for c in checklist_of(db, src.id):
        db.add(m.ChecklistItem(
            id=next_id(db, m.ChecklistItem, "CHK-", 4), proyecto_id=new_pid,
            texto=c.texto, hecha=False, orden=c.orden,
            horas_est=c.horas_est, demanda=c.demanda))
        db.flush()
    rollup_project(db, copy)
    touch(copy)
    log_change(db, new_pid, "Proyecto creado", "", f"Duplicado de {src.id}", usuario)
    return copy


def delete_project_cascade(db: Session, pid: str, usuario: str) -> None:
    p = db.get(m.Proyecto, pid)
    if not p:
        raise HTTPException(404, "Proyecto no encontrado")
    log_change(db, pid, "Proyecto eliminado", p.proyecto, "", usuario)
    act_ids = [a.id for a in acts_of(db, pid)]
    if act_ids:
        db.execute(delete(m.Comentario).where(m.Comentario.actividad_id.in_(act_ids)))
        db.execute(delete(m.Subtarea).where(m.Subtarea.actividad_id.in_(act_ids)))
    db.execute(delete(m.Comentario).where(m.Comentario.proyecto_id == pid))
    db.execute(delete(m.Actividad).where(m.Actividad.proyecto_id == pid))
    db.execute(delete(m.Hito).where(m.Hito.proyecto_id == pid))
    db.execute(delete(m.ChecklistItem).where(m.ChecklistItem.proyecto_id == pid))
    db.delete(p)


def rename_tag_refs(db: Session, old: str, new: str) -> None:
    for p in db.execute(select(m.Proyecto)).scalars():
        for f in ("etiqueta_1", "etiqueta_2", "etiqueta_3", "etiqueta_4", "etiqueta_5"):
            if norm(getattr(p, f)) == old:
                setattr(p, f, new)
    for a in db.execute(select(m.Actividad)).scalars():
        if norm(a.etiqueta) == old:
            a.etiqueta = new


def remove_tag_refs(db: Session, name: str) -> None:
    rename_tag_refs(db, name, "")


def rename_list_refs(db: Session, catalog: str, old: str, new: str) -> None:
    from .helpers import CATALOG_FIELD
    field = CATALOG_FIELD.get(catalog)
    if not field:
        return
    for p in db.execute(select(m.Proyecto)).scalars():
        if norm(getattr(p, field)) == old:
            setattr(p, field, new)
    if catalog == "Estado":
        for a in db.execute(select(m.Actividad)).scalars():
            if norm(a.estado) == old:
                a.estado = new


def recalc_all_acts(db: Session, pid: str) -> int:
    """Recalcula el avance de todas las actividades del proyecto.
    Con checklist: % de ítems tildados. Sin checklist: 100 si completada, 0 si no."""
    acts = acts_of(db, pid)
    if not acts:
        raise HTTPException(422, "Este proyecto no tiene actividades")
    changed = 0
    for a in acts:
        st = checklist_stats(subs_of(db, a.id))
        if st["total"] > 0:
            nuevo = st["pct"]
        else:
            completa = key_of(a.estado) == "completado" or (a.avance or 0) >= 100
            nuevo = 100 if completa else 0
        nuevo_est = ("Completado" if nuevo >= 100
                     else "En progreso" if nuevo > 0 else "Pendiente")
        if (a.avance or 0) != nuevo or norm(a.estado) != nuevo_est:
            changed += 1
        a.avance = nuevo
        a.estado = nuevo_est
    p = db.get(m.Proyecto, pid)
    if p:
        rollup_project(db, p)
        touch(p)
    return changed


def apply_sub_pct(db: Session, aid: str) -> m.Actividad:
    a = db.get(m.Actividad, aid)
    if not a:
        raise HTTPException(404, "Actividad no encontrada")
    st = checklist_stats(subs_of(db, aid))
    if not st["total"]:
        raise HTTPException(422, "La actividad no tiene ítems de checklist")
    a.avance = st["pct"]
    a.estado = ("Completado" if st["pct"] >= 100
                else "En progreso" if st["pct"] > 0 else "Pendiente")
    p = db.get(m.Proyecto, a.proyecto_id)
    if p:
        rollup_project(db, p)
        touch(p)
    return a


def set_act_done(db: Session, aid: str, done: bool) -> m.Actividad:
    a = db.get(m.Actividad, aid)
    if not a:
        raise HTTPException(404, "Actividad no encontrada")
    a.avance = 100 if done else 0
    a.estado = "Completado" if done else "Pendiente"
    p = db.get(m.Proyecto, a.proyecto_id)
    if p:
        rollup_project(db, p)
        touch(p)
    return a