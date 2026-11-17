"""Genera base_docs/demo.xlsx con datos ficticios para el seed y las capturas.

Uso: python scripts/generate_demo_xlsx.py [ruta_salida]
Determinista (semilla fija) para que el repo y las capturas sean reproducibles.
"""
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl

R = random.Random(20261117)
HOY = date.today()

PERSONAS = [
    ("Ana Torres", "Supervisora de mantenimiento", "Mantenimiento", "Base Norte"),
    ("Bruno Díaz", "Instrumentista", "Automatización", "Base Norte"),
    ("Carla Méndez", "Ingeniera de procesos", "Ingeniería", "Base Sur"),
    ("Diego Fuentes", "Operador senior", "Operaciones", "Base Sur"),
    ("Elena Ríos", "Analista HSE", "Seguridad", "Base Norte"),
    ("Facundo Sosa", "Electricista", "Mantenimiento", "Base Sur"),
    ("Gabriela Paz", "Planificadora OT", "Ingeniería", "Base Norte"),
    ("Hugo Varela", "Mecánico de planta", "Mantenimiento", "Base Sur"),
]
YACIMIENTOS = ["Yacimiento Norte", "Yacimiento Sur", "Bloque Este", "Bloque Oeste", "Campo Demo A"]
INSTALACIONES = ["Planta Demo 1", "Planta Demo 2", "Estación Norte", "Estación Sur", "Batería Central", "Ducto Principal"]
AREAS = ["Mantenimiento", "Operaciones", "Ingeniería", "Seguridad", "Automatización"]
ESTADOS = ["Pendiente", "En progreso", "Testing", "En revisión", "Completado", "Cancelado"]
PRIORIDADES = ["Alta", "Media", "Baja"]
FASES = ["Fase 1", "Fase 2", "Fase 3"]
SPRINTS = ["Backlog", "Sprint 1", "Sprint 2", "Sprint 3"]
TAGS = [
    ("Urgente", "Prioridad", "E03131"), ("Crítico", "Prioridad", "C92A2A"),
    ("Mejora", "Tipo", "2C7BE5"), ("Parada", "Tipo", "7048E8"),
    ("Integridad", "Disciplina", "0C8599"), ("SCADA", "Disciplina", "5C7CFA"),
    ("Eléctrica", "Disciplina", "F08C00"), ("Mecánica", "Disciplina", "2F9E44"),
    ("Instrumentación", "Disciplina", "AE3EC9"), ("HSE", "Tipo", "E8590C"),
]
PROYECTOS = [
    "Mantenimiento compresor K-101", "Inspección de ducto principal",
    "Automatización tablero T-2", "Calibración de instrumentos",
    "Parada programada planta 1", "Reemplazo de válvulas SDV",
    "Pruebas de pozos piloto", "Montaje de bomba P-204",
    "Adecuación eléctrica subestación", "Campaña de medición fiscal",
    "Reparación de tanque T-301", "Instalación de variadores",
    "Auditoría de seguridad de proceso", "Optimización de separadores",
    "Tendido de fibra óptica", "Puesta en marcha planta 2",
    "Relevamiento de activos", "Plan de integridad mecánica",
    "Mejora de sistema SCADA", "Balance de energía planta 1",
    "Cambio de sellos mecánicos", "Ensayo de materiales críticos",
    "Gestión de repuestos críticos", "Capacitación operativa demo",
]
ACTS = ["Relevamiento inicial", "Ingeniería de detalle", "Procura de materiales",
        "Ejecución en campo", "Pruebas y puesta a punto", "Documentación final",
        "Inspección de calidad", "Cierre administrativo"]
CK = ["Revisar procedimiento", "Permiso de trabajo aprobado", "Bloqueo y etiquetado",
      "Verificar repuestos", "Ejecutar tarea", "Control de calidad",
      "Registrar en sistema", "Cerrar orden de trabajo"]
COMS = ["Se coordinó con operaciones la ventana de trabajo.",
        "Materiales disponibles en almacén central.",
        "Pendiente aprobación del permiso HSE.",
        "Avance según plan, sin desvíos.",
        "Se reprogramó por condiciones climáticas."]


def d(offset: int) -> date:
    return HOY + timedelta(days=offset)


def build() -> openpyxl.Workbook:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    def sheet(name, cols, rows):
        ws = wb.create_sheet(name)
        ws.append(cols)
        for r in rows:
            ws.append(r)
        return ws

    # --- Proyectos / actividades / subtareas / hitos / comentarios ---
    proy_rows, act_rows, sub_rows, hito_rows, com_rows, ck_rows, hist_rows = [], [], [], [], [], [], []
    na = ns = nh = nc = nk = 0
    for k, nombre in enumerate(PROYECTOS, start=1):
        pid = f"PRY-{k:03d}"
        checklist = k % 6 == 0
        estado = ESTADOS[k % len(ESTADOS)]
        final = estado in ("Completado", "Cancelado")
        ini = d(-R.randint(15, 70))
        fin = ini + timedelta(days=R.randint(12, 55))
        avance = 100 if final else (0 if estado == "Pendiente" else R.randint(10, 90))
        tags = R.sample([t[0] for t in TAGS], R.randint(1, 3))
        resp = PERSONAS[k % len(PERSONAS)][0]
        rt = PERSONAS[(k + 3) % len(PERSONAS)][0]
        pl = PERSONAS[(k + 5) % len(PERSONAS)][0]
        proy_rows.append([
            pid, nombre, f"Proyecto demo {k} generado para pruebas de la aplicación.",
            resp, rt, pl, AREAS[k % len(AREAS)], YACIMIENTOS[k % len(YACIMIENTOS)],
            INSTALACIONES[k % len(INSTALACIONES)], estado, PRIORIDADES[k % 3],
            None if checklist else ini, None if checklist else fin, avance,
            SPRINTS[k % len(SPRINTS)], FASES[k % len(FASES)],
            *tags, *([""] * (5 - len(tags))),
            "Datos ficticios de demostración.", datetime.now(), "",
            "Checklist" if checklist else "Gantt",
        ])
        hist_rows.append([f"CH-{k:04d}", pid, "estado", "Pendiente", estado, resp, datetime.now()])
        if checklist:
            for j in range(R.randint(5, 9)):
                nk += 1
                ck_rows.append([f"CHK-{nk:04d}", pid, CK[j % len(CK)],
                                "Si" if j < avance // 12 else "No", j + 1,
                                R.randint(1, 8), PRIORIDADES[j % 3]])
            continue
        prev = ""
        cursor = ini
        for j in range(R.randint(3, 6)):
            na += 1
            aid = f"ACT-{na:03d}"
            a_ini = cursor + timedelta(days=R.randint(0, 2))
            a_fin = a_ini + timedelta(days=R.randint(3, 12))
            cursor = a_fin
            a_av = 100 if final else max(0, min(100, avance + R.randint(-25, 25)))
            act_rows.append([aid, pid, ACTS[j % len(ACTS)], a_ini, a_fin, a_av,
                             TAGS[(k + j) % len(TAGS)][0],
                             "Completado" if a_av >= 100 else ("En progreso" if a_av > 0 else "Pendiente"),
                             prev if R.random() < 0.6 else "", R.randint(1, 3)])
            if R.random() < 0.6:
                prev = aid
            for s in range(R.randint(0, 3)):
                ns += 1
                sub_rows.append([f"SUB-{ns:03d}", aid, pid, f"Subtarea demo {s + 1}",
                                 "Si" if R.random() < a_av / 100 else "No", s + 1,
                                 R.randint(1, 6), PRIORIDADES[s % 3]])
            if R.random() < 0.5:
                nc += 1
                com_rows.append([f"CM-{nc:04d}", aid, pid, resp, datetime.now(), COMS[nc % len(COMS)]])
        for h in range(R.randint(1, 2)):
            nh += 1
            hito_rows.append([f"HITO-{nh:03d}", pid, f"Hito demo {h + 1}",
                              ini + timedelta(days=R.randint(5, 40)),
                              "Cumplido" if final else "Pendiente"])
        if R.random() < 0.5:
            nc += 1
            com_rows.append([f"CM-{nc:04d}", "", pid, pl, datetime.now(), COMS[nc % len(COMS)]])

    sheet("Proyectos", ["ID_Proyecto", "Proyecto", "Descripcion", "Responsable",
          "Responsable_Tecnico", "Project_Leader", "Area", "Yacimiento", "Instalacion",
          "Estado", "Prioridad", "Fecha_Inicio", "Fecha_Fin_Estimada", "Avance_%",
          "Sprint", "Fase", "Etiqueta_1", "Etiqueta_2", "Etiqueta_3", "Etiqueta_4",
          "Etiqueta_5", "Comentarios", "Ultima_Actualizacion", "Enlaces", "Modo_Tareas"], proy_rows)
    sheet("Actividades", ["ID_Actividad", "ID_Proyecto", "Actividad", "Fecha_Inicio",
          "Fecha_Fin", "Avance_%", "Etiqueta", "Estado", "Depende_De", "Peso"], act_rows)
    sheet("Subtareas", ["ID_Subtarea", "ID_Actividad", "ID_Proyecto", "Texto", "Hecha",
          "Orden", "Horas_Est", "Demanda"], sub_rows)
    sheet("Hitos", ["ID_Hito", "ID_Proyecto", "Hito", "Fecha", "Estado"], hito_rows)
    sheet("Comentarios_Act", ["ID_Comentario", "ID_Actividad", "ID_Proyecto", "Autor",
          "Fecha_Hora", "Comentario"], com_rows)
    sheet("Checklist_Proyecto", ["ID_ItemCK", "ID_Proyecto", "Texto", "Hecha", "Orden",
          "Horas_Est", "Demanda"], ck_rows)
    sheet("Historial_Cambios", ["ID_Cambio", "ID_Proyecto", "Campo_Modificado",
          "Valor_Anterior", "Valor_Nuevo", "Usuario", "Fecha_Hora"], hist_rows)
    sheet("Etiquetas", ["ID_Etiqueta", "Etiqueta", "Categoria", "Color_Hex", "Activa"],
          [[f"ET-{i:02d}", n, c, col, "Si"] for i, (n, c, col) in enumerate(TAGS, 1)])

    # --- Listas (una columna por catálogo) ---
    cats = {"Estado": ESTADOS, "Prioridad": PRIORIDADES, "Area": AREAS, "Sprint": SPRINTS,
            "Fase": FASES, "Responsable": [p[0] for p in PERSONAS],
            "Responsable_Tecnico": [p[0] for p in PERSONAS],
            "Project_Leader": [p[0] for p in PERSONAS],
            "Yacimiento": YACIMIENTOS, "Instalacion": INSTALACIONES}
    depth = max(len(v) for v in cats.values())
    sheet("Listas", list(cats), [[cats[c][i] if i < len(cats[c]) else "" for c in cats]
                                for i in range(depth)])

    # --- Personal / ausencias ---
    per_rows, aus_rows = [], []
    for i, (nombre, puesto, area, base) in enumerate(PERSONAS, 1):
        per_rows.append([f"PER-{i:03d}", nombre, puesto, area, f"D-{1000 + i}", base,
                         0, R.randint(0, 6), "Persona ficticia de demostración."])
        for a in range(R.randint(1, 3)):
            tipo = ["Vacaciones", "Trámite", "Franco", "Franco Generado"][(i + a) % 4]
            desde = d(R.randint(-15, 20))
            aus_rows.append([f"AUS-{i:02d}{a + 1}", f"PER-{i:03d}", tipo, desde,
                             desde + timedelta(days=R.randint(0, 3)), ""])
    sheet("Personal", ["ID_Persona", "Nombre", "Puesto", "Area", "Legajo", "Base",
          "Francos_Disponibles", "Francos_Generados", "Notas"], per_rows)
    sheet("Ausencias", ["ID_Ausencia", "ID_Persona", "Tipo", "Desde", "Hasta", "Notas"], aus_rows)
    return wb


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "base_docs" / "demo.xlsx"
    wb = build()
    wb.save(out)
    print(f"Demo generado: {out} ({', '.join(wb.sheetnames)})")