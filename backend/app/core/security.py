from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from .config import settings


def get_password_hash(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), hashed.encode())
    except ValueError:
        return False


def _token(data: dict, delta: timedelta, token_type: str) -> str:
    payload = {**data, "type": token_type,
               "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, settings.security.jwt.secret_key,
                      algorithm=settings.security.jwt.algorithm)


def create_access_token(data: dict) -> str:
    return _token(data, timedelta(
        minutes=settings.security.jwt.access_token_expire_minutes), "access")


def create_refresh_token(data: dict) -> str:
    return _token(data, timedelta(
        days=settings.security.jwt.refresh_token_expire_days), "refresh")


def decode_token(token: str, expected_type: str = "access") -> dict | None:
    try:
        payload = jwt.decode(token, settings.security.jwt.secret_key,
                             algorithms=[settings.security.jwt.algorithm])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload