from pathlib import Path

import openpyxl
import pytest

from app.core.config import BASE_DIR
from app.utils.excel_import import import_workbook
from conftest import TestingSession

BD = (BASE_DIR / "../base_docs/demo.xlsx").resolve()


@pytest.mark.skipif(not BD.exists(), reason="demo.xlsx no disponible")
def test_import_demo_xlsx():
    wb = openpyxl.load_workbook(BD, data_only=True)
    db = TestingSession()
    try:
        counts = import_workbook(db, wb, replace=True)
        db.commit()
        assert counts["proyectos"] > 0
        assert counts["actividades"] > 0
        assert counts["lista_valores"] > 0
        from app import models as m
        from sqlalchemy import select
        for p in db.execute(select(m.Proyecto)).scalars():
            assert p.proyecto and p.responsable
            assert 0 <= p.avance <= 100
        for a in db.execute(select(m.Actividad)).scalars():
            assert db.get(m.Proyecto, a.proyecto_id) is not None
    finally:
        db.rollback()
        db.close()