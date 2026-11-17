import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .api import (actividades, auth, checklist, comentarios, etiquetas, excel,
                  historial, hitos, listas, personal, proyectos, snapshot)
from .core.config import settings, warn_if_placeholder_secrets
from .core.database import SessionLocal
from .core.rate_limit import limiter
from .core.security import decode_token
from .core.websocket import manager, set_loop
from . import models as m
from .utils.seed import seed_all

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("plannerot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    warn_if_placeholder_secrets()
    seed_all()
    set_loop(asyncio.get_running_loop())
    log.info("PlannerOT API lista en http://%s:%s", settings.server.host, settings.server.port)
    yield


app = FastAPI(title="PlannerOT API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.server.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api"
app.include_router(auth.router, prefix=f"{API}/auth", tags=["auth"])
app.include_router(auth.users_router, prefix=f"{API}/users", tags=["users"])
app.include_router(snapshot.router, prefix=f"{API}/snapshot", tags=["snapshot"])
app.include_router(proyectos.router, prefix=f"{API}/proyectos", tags=["proyectos"])
app.include_router(actividades.router, prefix=f"{API}/actividades", tags=["actividades"])
app.include_router(comentarios.router, prefix=f"{API}/comentarios", tags=["comentarios"])
app.include_router(checklist.router, prefix=f"{API}/checklist", tags=["checklist"])
app.include_router(checklist.sub_router, prefix=f"{API}/subtareas", tags=["subtareas"])
app.include_router(hitos.router, prefix=f"{API}/hitos", tags=["hitos"])
app.include_router(etiquetas.router, prefix=f"{API}/etiquetas", tags=["etiquetas"])
app.include_router(listas.router, prefix=f"{API}/listas", tags=["listas"])
app.include_router(personal.router, prefix=f"{API}/personal", tags=["personal"])
app.include_router(personal.aus_router, prefix=f"{API}/ausencias", tags=["ausencias"])
app.include_router(historial.router, prefix=f"{API}/historial", tags=["historial"])
app.include_router(excel.router, prefix=f"{API}/excel", tags=["excel"])


@app.get(f"{API}/health")
def health():
    return {"status": "ok", "app": "PlannerOT"}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = Query(""), topics: str = Query("data")):
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4401)
        return
    db = SessionLocal()
    try:
        user = db.get(m.User, int(payload.get("sub", 0)))
        if not user or not user.is_active:
            await ws.close(code=4401)
            return
    finally:
        db.close()
    await manager.connect(ws, [t.strip() for t in topics.split(",") if t.strip()])
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)