import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.core.database import Base, get_db
from app.core.rate_limit import limiter
from app.core.security import get_password_hash
from app.main import app

limiter.enabled = False

engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                       poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    db.add(m.User(username="admin", display_name="Administrador",
                  hashed_password=get_password_hash("admin123"),
                  is_admin=True, is_active=True))
    db.commit()
    db.close()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth(client):
    r = client.post("/api/auth/login",
                    data={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def proyecto(client, auth):
    r = client.post("/api/proyectos", headers=auth, json={
        "proyecto": "Planta Demo Compresora", "responsable": "Ana Gómez",
        "area": "Operaciones", "yacimiento": "Yacimiento Norte", "estado": "Pendiente",
        "fecha_inicio": "2026-01-05", "fecha_fin_estimada": "2026-02-05",
        "etiquetas": ["Urgente"]})
    assert r.status_code == 201, r.text
    return r.json()