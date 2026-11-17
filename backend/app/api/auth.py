from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..core.database import get_db
from ..core.deps import get_current_active_user, get_current_admin_user
from ..core.rate_limit import LOGIN_LIMIT, limiter
from ..core.security import (create_access_token, create_refresh_token,
                             decode_token, get_password_hash, verify_password)
from ..schemas import TokenPair, UserCreate, UserResponse, UserUpdate

router = APIRouter()


@router.post("/login", response_model=TokenPair)
@limiter.limit(LOGIN_LIMIT)
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    user = db.execute(select(m.User).where(
        m.User.username == form.username)).scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if not user.is_active:
        raise HTTPException(400, "Inactive user")
    data = {"sub": str(user.id)}
    return TokenPair(access_token=create_access_token(data),
                     refresh_token=create_refresh_token(data))


@router.post("/refresh", response_model=TokenPair)
def refresh(refresh_token: str, db: Session = Depends(get_db)):
    payload = decode_token(refresh_token, expected_type="refresh")
    user = db.get(m.User, int(payload.get("sub", 0))) if payload else None
    if not user or not user.is_active:
        raise HTTPException(401, "Refresh token inválido")
    data = {"sub": str(user.id)}
    return TokenPair(access_token=create_access_token(data),
                     refresh_token=create_refresh_token(data))


@router.get("/me", response_model=UserResponse)
def me(u: m.User = Depends(get_current_active_user)):
    return u


users_router = APIRouter()


@users_router.get("", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db),
               _: m.User = Depends(get_current_admin_user)):
    return list(db.execute(select(m.User).order_by(m.User.id)).scalars())


@users_router.post("", response_model=UserResponse, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db),
                _: m.User = Depends(get_current_admin_user)):
    if db.execute(select(m.User).where(
            m.User.username == data.username)).scalar_one_or_none():
        raise HTTPException(422, "Ya existe un usuario con ese nombre")
    u = m.User(username=data.username, display_name=data.display_name or data.username,
               hashed_password=get_password_hash(data.password), is_admin=data.is_admin)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@users_router.put("/{uid}", response_model=UserResponse)
def update_user(uid: int, data: UserUpdate, db: Session = Depends(get_db),
                admin: m.User = Depends(get_current_admin_user)):
    u = db.get(m.User, uid)
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if data.password is not None:
        u.hashed_password = get_password_hash(data.password)
    if data.display_name is not None:
        u.display_name = data.display_name
    if data.is_admin is not None:
        u.is_admin = data.is_admin
    if data.is_active is not None:
        if u.id == admin.id and not data.is_active:
            raise HTTPException(422, "No podés desactivarte a vos mismo")
        u.is_active = data.is_active
    db.commit()
    db.refresh(u)
    return u


@users_router.delete("/{uid}", status_code=204)
def delete_user(uid: int, db: Session = Depends(get_db),
                admin: m.User = Depends(get_current_admin_user)):
    u = db.get(m.User, uid)
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.id == admin.id:
        raise HTTPException(422, "No podés eliminarte a vos mismo")
    db.delete(u)
    db.commit()