from pathlib import Path
from typing import List

import yaml
from pydantic import BaseModel
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


def build_database_url(db_type: str, host: str, port: int, user: str,
                       password: str, name: str) -> str:
    if db_type == "postgresql":
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"
    if db_type == "sqlite":
        return f"sqlite:///{BASE_DIR / f'{name}.db'}"
    raise ValueError(f"Unsupported database type: {db_type}")


class DatabaseSettings(BaseSettings):
    type: str = "sqlite"
    host: str = ""
    port: int = 5432
    user: str = ""
    password: str = ""
    name: str = "plannerot"

    @property
    def url(self) -> str:
        return build_database_url(self.type, self.host, self.port,
                                  self.user, self.password, self.name)


class JWTSettings(BaseSettings):
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7


class SecuritySettings(BaseSettings):
    jwt: JWTSettings


class ServerSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    ssl_keyfile: str = ""
    ssl_certfile: str = ""
    cors_origins: List[str] = ["http://localhost:3000"]


class SeedSettings(BaseSettings):
    excel_path: str = "../base_docs/demo.xlsx"
    admin_username: str = "admin"
    admin_password: str = "admin123"


class RateLimitSettings(BaseSettings):
    login: str = "10/minute"


class Settings(BaseSettings):
    database: DatabaseSettings
    security: SecuritySettings
    server: ServerSettings
    seed: SeedSettings = SeedSettings()
    rate_limit: RateLimitSettings = RateLimitSettings()


def load_config() -> Settings:
    path = BASE_DIR / "config.yaml"
    if not path.exists():
        path = BASE_DIR / "config.yaml.example"
    with open(path, encoding="utf-8") as f:
        return Settings(**yaml.safe_load(f))


settings = load_config()


def warn_if_placeholder_secrets() -> None:
    import logging
    if "CHANGE_ME" in settings.security.jwt.secret_key:
        logging.getLogger("plannerot").warning(
            "JWT secret_key sigue siendo el placeholder del ejemplo: "
            "generá uno aleatorio en config.yaml antes de producción.")
    if settings.seed.admin_password == "admin123":
        logging.getLogger("plannerot").warning(
            "Contraseña del admin sembrada es 'admin123': cambiala tras el primer login.")