from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from .. import models as m
from .database import get_db
from .security import decode_token

security = HTTPBearer()


async def get_current_user(creds=Depends(security), db: Session = Depends(get_db)) -> m.User:
    payload = decode_token(creds.credentials)
    user = db.get(m.User, int(payload.get("sub", 0))) if payload else None
    if not user:
        raise HTTPException(401, "Could not validate credentials",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


async def get_current_active_user(u: m.User = Depends(get_current_user)) -> m.User:
    if not u.is_active:
        raise HTTPException(400, "Inactive user")
    return u


async def get_current_admin_user(u: m.User = Depends(get_current_active_user)) -> m.User:
    if not u.is_admin:
        raise HTTPException(403, "Not enough permissions")
    return u