"""Exportación de la base a Excel con el mismo layout que Kanban.html."""
from datetime import datetime

import openpyxl
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m

COLS = ["ID_Proyecto", "Proyecto", "Descripcion", "Responsable", "Responsable_Tecnico",
        "Project_Leader", "Area", "Yacimiento", "Instalacion", "Estado", "Prioridad",
        "Fecha_Inicio", "Fecha_Fin_Estimada", "Avance_%", "Sprint", "Fase",
        "Etiqueta_1", "Etiqueta_2", "Etiqueta_3", "Etiqueta_4", "Etiqueta_5",
        "Comentarios", "Ultima_Actualizacion", "Enlaces", "Modo_Tareas"]
ACT_COLS = ["ID_Actividad", "ID_Proyecto", "Actividad", "Fecha_Inicio", "Fecha_Fin",
            "Avance_%", "Etiqueta", "Estado", "Depende_De", "Peso"]
COM_COLS = ["ID_Comentario", "ID_Actividad", "ID_Proyecto", "Autor", "Fecha_Hora", "Comentario"]
HIST_COLS = ["ID_Cambio", "ID_Proyecto", "Campo_Modificado", "Valor_Anterior",
             "Valor_Nuevo", "Usuario", "Fecha_Hora"]
SUB_COLS = ["ID_Subtarea", "ID_Actividad", "ID_Proyecto", "Texto", "Hecha", "Orden",
            "Horas_Est", "Demanda"]
MIL_COLS = ["ID_Hito", "ID_Proyecto", "Hito", "Fecha", "Estado"]
ETQ_COLS = ["ID_Etiqueta", "Etiqueta", "Categoria", "Color_Hex", "Activa"]
LIS_COLS = ["Estado", "Prioridad", "Area", "Sprint", "Fase", "Responsable",
            "Responsable_Tecnico", "Project_Leader", "Yacimiento", "Instalacion"]
CHK_COLS = ["ID_ItemCK", "ID_Proyecto", "Texto", "Hecha", "Orden", "Horas_Est", "Demanda"]
PER_COLS = ["ID_Persona", "Nombre", "Puesto", "Area", "Legajo", "Base",
            "Francos_Disponibles", "Francos_Generados", "Notas"]
AUS_COLS = ["ID_Ausencia", "ID_Persona", "Tipo", "Desde", "Hasta", "Notas"]

DATE_FMT = "dd/mm/yyyy"
DT_FMT = "dd/mm/yyyy hh:mm"


def _sheet(wb, name, cols, rows, date_cols=(), dt_cols=(), pct_cols=()):
    ws = wb.create_sheet(name)
    ws.append(cols)
    for c in ws[1]:
        c.font = openpyxl.styles.Font(bold=True, color="FFFFFF")
        c.fill = openpyxl.styles.PatternFill("solid", fgColor="1F4E78")
    for row in rows:
        ws.append(row)
    for r in range(2, ws.max_row + 1):
        for ci in date_cols:
            ws.cell(r, ci).number_format = DATE_FMT
        for ci in dt_cols:
            ws.cell(r, ci).number_format = DT_FMT
        for ci in pct_cols:
            ws.cell(r, ci).number_format = '0"%"'
    for i in range(1, len(cols) + 1):
        ws.column_dimensions[get_column_letter(i)].width = 18
    ws.freeze_panes = "A2"
    return ws


def export_workbook(db: Session) -> openpyxl.Workbook:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    proy = list(db.execute(select(m.Proyecto).order_by(m.Proyecto.id)).scalars())
    _sheet(wb, "Proyectos", COLS, [
        [p.id, p.proyecto, p.descripcion, p.responsable, p.responsable_tecnico,
         p.project_leader, p.area, p.yacimiento, p.instalacion, p.estado, p.prioridad,
         p.fecha_inicio, p.fecha_fin_estimada, p.avance, p.sprint, p.fase,
         p.etiqueta_1, p.etiqueta_2, p.etiqueta_3, p.etiqueta_4, p.etiqueta_5,
         p.comentarios, p.ultima_actualizacion, p.enlaces, p.modo_tareas]
        for p in proy], date_cols=(12, 13), dt_cols=(23,), pct_cols=(14,))

    acts = list(db.execute(select(m.Actividad).order_by(
        m.Actividad.proyecto_id, m.Actividad.orden, m.Actividad.id)).scalars())
    _sheet(wb, "Actividades", ACT_COLS, [
        [a.id, a.proyecto_id, a.actividad, a.fecha_inicio, a.fecha_fin, a.avance,
         a.etiqueta, a.estado, a.depende_de, a.peso] for a in acts],
        date_cols=(4, 5), pct_cols=(6,))

    etq = list(db.execute(select(m.Etiqueta).order_by(m.Etiqueta.id)).scalars())
    _sheet(wb, "Etiquetas", ETQ_COLS, [
        [t.id, t.etiqueta, t.categoria, t.color_hex, "Si" if t.activa else "No"]
        for t in etq])

    cats = {c: [] for c in LIS_COLS}
    for lv in db.execute(select(m.ListaValor).order_by(
            m.ListaValor.catalog, m.ListaValor.position)).scalars():
        if lv.catalog in cats:
            cats[lv.catalog].append(lv.value)
    max_len = max((len(v) for v in cats.values()), default=0)
    _sheet(wb, "Listas", LIS_COLS, [
        [cats[c][r] if r < len(cats[c]) else "" for c in LIS_COLS]
        for r in range(max_len)])

    coms = list(db.execute(select(m.Comentario).order_by(m.Comentario.id)).scalars())
    _sheet(wb, "Comentarios_Act", COM_COLS, [
        [c.id, c.actividad_id, c.proyecto_id, c.autor, c.fecha_hora, c.comentario]
        for c in coms], dt_cols=(5,))

    hist = list(db.execute(select(m.HistorialCambio).order_by(
        m.HistorialCambio.id)).scalars())
    _sheet(wb, "Historial_Cambios", HIST_COLS, [
        [h.id, h.proyecto_id, h.campo, h.valor_anterior, h.valor_nuevo,
         h.usuario, h.fecha_hora] for h in hist], dt_cols=(7,))

    subs = list(db.execute(select(m.Subtarea).order_by(
        m.Subtarea.actividad_id, m.Subtarea.orden)).scalars())
    _sheet(wb, "Subtareas", SUB_COLS, [
        [s.id, s.actividad_id, s.proyecto_id, s.texto, "Si" if s.hecha else "No",
         s.orden, s.horas_est if s.horas_est else "", s.demanda] for s in subs])

    miles = list(db.execute(select(m.Hito).order_by(m.Hito.id)).scalars())
    _sheet(wb, "Hitos", MIL_COLS, [
        [h.id, h.proyecto_id, h.hito, h.fecha, h.estado] for h in miles], date_cols=(4,))

    pers = list(db.execute(select(m.Persona).order_by(m.Persona.id)).scalars())
    _sheet(wb, "Personal", PER_COLS, [
        [p.id, p.nombre, p.puesto, p.area, p.legajo, p.base,
         p.francos_disponibles, p.francos_generados, p.notas] for p in pers])

    aus = list(db.execute(select(m.Ausencia).order_by(m.Ausencia.id)).scalars())
    _sheet(wb, "Ausencias", AUS_COLS, [
        [a.id, a.persona_id, a.tipo, a.desde, a.hasta, a.notas] for a in aus],
        date_cols=(4, 5))

    chk = list(db.execute(select(m.ChecklistItem).order_by(
        m.ChecklistItem.proyecto_id, m.ChecklistItem.orden)).scalars())
    _sheet(wb, "Checklist_Proyecto", CHK_COLS, [
        [c.id, c.proyecto_id, c.texto, "Si" if c.hecha else "No", c.orden,
         c.horas_est if c.horas_est else "", c.demanda] for c in chk])
    return wb