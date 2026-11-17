import io
from datetime import datetime

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user, get_current_admin_user
from ..core.websocket import notify
from ..utils.excel_export import export_workbook
from ..utils.excel_import import import_workbook

router = APIRouter()


@router.get("/export")
def export_excel(db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_active_user)):
    wb = export_workbook(db)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"PlannerOT_{datetime.now():%Y%m%d_%H%M}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.post("/import")
def import_excel(file: UploadFile = File(...), replace: bool = True,
                 db: Session = Depends(get_db),
                 u: m.User = Depends(get_current_admin_user)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(422, "Subí un archivo .xlsx")
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file.file.read()), data_only=True)
    except Exception:
        raise HTTPException(422, "No se pudo leer el archivo Excel")
    if not any(n.lower().startswith("proyecto") for n in wb.sheetnames):
        raise HTTPException(422, "El archivo no tiene una hoja 'Proyectos'")
    counts = import_workbook(db, wb, replace=replace)
    db.commit()
    notify()
    return {"imported": counts}