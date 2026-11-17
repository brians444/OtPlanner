"""Seed idempotente: tablas, admin inicial y datos demo desde demo.xlsx si la base está vacía."""
import logging
from pathlib import Path

import openpyxl
from sqlalchemy import select

from .. import models as m
from ..core.config import BASE_DIR, settings
from ..core.database import Base, SessionLocal, engine
from ..core.security import get_password_hash
from ..utils.excel_import import import_workbook

log = logging.getLogger("plannerot")

DEFAULT_CATALOGS = {
    "Estado": ["Pendiente", "En progreso", "Testing", "Completado", "Cancelado"],
    "Prioridad": ["Alta", "Media", "Baja"],
    "Fase": ["Fase 1", "Fase 2", "Cerrado"],
    "Sprint": ["Backlog"],
}
DEFAULT_TAGS = [
    ("ET-01", "Urgente", "Prioridad", "E03131"),
    ("ET-02", "Crítico", "Prioridad", "C92A2A"),
    ("ET-03", "Mejora", "Tipo", "2C7BE5"),
]


def seed_all() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.execute(select(m.User.id).limit(1)).first():
            db.add(m.User(
                username=settings.seed.admin_username,
                display_name="Administrador",
                hashed_password=get_password_hash(settings.seed.admin_password),
                is_admin=True, is_active=True))
            db.commit()
            log.info("Usuario admin '%s' creado.", settings.seed.admin_username)

        has_proy = db.execute(select(m.Proyecto.id).limit(1)).first()
        if not has_proy:
            excel = (BASE_DIR / settings.seed.excel_path).resolve()
            if excel.exists():
                wb = openpyxl.load_workbook(excel, data_only=True)
                counts = import_workbook(db, wb, replace=True)
                db.commit()
                log.info("Seed desde %s: %s", excel.name, counts)
            else:
                log.warning("No existe %s; se siembran catálogos por defecto.", excel)

        if not db.execute(select(m.ListaValor.id).limit(1)).first():
            for cat, vals in DEFAULT_CATALOGS.items():
                for pos, v in enumerate(vals):
                    db.add(m.ListaValor(catalog=cat, value=v, position=pos))
            for tid, name, cat, color in DEFAULT_TAGS:
                if not db.get(m.Etiqueta, tid):
                    db.add(m.Etiqueta(id=tid, etiqueta=name, categoria=cat,
                                      color_hex=color, activa=True))
            db.commit()
    finally:
        db.close()