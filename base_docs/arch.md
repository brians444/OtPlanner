# Arquitectura de referencia: FastAPI + Next.js con despliegue offline en Windows

Plantilla de arquitectura para aplicaciones web internas (inventario, gestión,
administración) que deben funcionar **on-premise y sin acceso a internet**.
Describe el stack, la estructura, los patrones obligatorios y el empaquetado,
con fragmentos de código listos para adaptar. Los nombres (`Item`, `myapp`,
puertos) son ejemplos.

---

## 1. Visión general

```
 Navegador ──HTTP :3000──▶ Next.js standalone (node server.js)
     │                       sirve la SPA + /runtime-config.js (sin cache)
     │
     └──HTTPS :8000 (REST + WebSocket)──▶ FastAPI / Uvicorn
                                            ├─ SQLAlchemy ─▶ SQLite | PostgreSQL
                                            ├─ APScheduler (jobs periódicos)
                                            └─ httpx ─▶ webhooks salientes
```

Decisiones de base:
- **Dos procesos independientes**: API Python y frontend Node. El navegador
  llama directo a la API (CORS), sin proxy ni BFF.
- **SPA autenticada servida por Next.js**: todas las páginas son client
  components; Next aporta routing, build y servidor estático, no SSR de datos.
- **Un solo archivo de configuración** del backend (YAML), sin variables de
  entorno obligatorias: fácil de editar en un servidor Windows.
- **SQLite por defecto, PostgreSQL opcional**, con migraciones que funcionen en
  ambos.
- **Instalación offline**: ZIP con Python embeddable, Node portable, wheels y
  NSSM; un `.bat` instala todo sin red.

---

## 2. Stack

### Backend — Python 3.11

| Paquete | Rol |
|---|---|
| fastapi | HTTP + WebSocket, OpenAPI automático |
| uvicorn[standard] | ASGI, TLS nativo con `--ssl-keyfile/--ssl-certfile` |
| sqlalchemy 2.x | ORM declarativo (`DeclarativeBase`) |
| alembic | Migraciones |
| psycopg2-binary | Driver PostgreSQL |
| pydantic 2 + pydantic[email] + pydantic-settings | Schemas y config tipada |
| python-jose[cryptography] | JWT HS256 |
| bcrypt | Hash de contraseñas (directo, sin passlib) |
| cryptography | Cifrado de secretos en BD (Fernet) y certificados TLS |
| python-multipart | Form de login OAuth2 y uploads |
| pyyaml | Lectura de `config.yaml` |
| slowapi | Rate limiting |
| apscheduler 3.x | Jobs en background |
| httpx | Llamadas salientes (webhooks) |
| pytest | Tests con `fastapi.testclient` |

Fijar versiones exactas (`==`) en `requirements.txt`: el bundle offline
descarga exactamente esas wheels.

### Frontend — Node 20

| Paquete | Rol |
|---|---|
| next (App Router) + react + typescript | Base; `output: 'standalone'` |
| @tanstack/react-query | Fetching, cache, mutaciones e invalidación |
| axios | Cliente HTTP con interceptors |
| tailwindcss + tailwindcss-animate | Estilos, `darkMode: ["class"]` |
| shadcn/ui (componentes copiados) + @radix-ui/* | Componentes accesibles |
| class-variance-authority, clsx, tailwind-merge | Variantes y helper `cn()` |
| lucide-react | Iconos (un único set) |
| cmdk | Command palette / combobox |
| recharts | Gráficos |
| date-fns | Fechas |
| react-hook-form + zod (opcional) | Formularios complejos con validación |

Sin Redux/Zustand: el estado del servidor vive en React Query; las
preferencias de UI en `localStorage`.

### Runtime de despliegue
Python embeddable win-amd64, Node portable win-x64, NSSM (servicios Windows).

---

## 3. Estructura de carpetas

```
backend/
  app/
    main.py               # app, middlewares, routers, /api/health, lifespan
    core/
      config.py           # Settings tipados desde config.yaml
      database.py         # engine, SessionLocal, Base, get_db
      security.py         # bcrypt, JWT, cifrado de secretos
      deps.py             # usuario actual, admin, require_permission, ACL
      rate_limit.py       # Limiter singleton
      scheduler.py        # APScheduler
      websocket.py        # ConnectionManager por topics
    api/<recurso>.py      # Un APIRouter por recurso
    models/               # SQLAlchemy; __init__.py importa todo
    schemas/              # Pydantic: XCreate, XUpdate, XResponse
    crud/                 # Acceso a datos
    middleware/audit.py   # Auditoría de mutaciones
    utils/                # Lógica auxiliar (red, webhooks, etc.)
  alembic/ + alembic.ini
  tests/conftest.py
  config.yaml.example
  create_admin.py  seed_roles.py  generate_cert.py
frontend/
  src/app/<ruta>/page.tsx
  src/components/         # Shell, guards, providers, dominio
  src/components/ui/      # shadcn/ui
  src/lib/                # config.ts, api.ts, services.ts, hooks
  src/types/index.ts      # Tipos espejo de los schemas
  src/i18n/               # <lang>.json + provider
  public/runtime-config.js
scripts/                  # install.bat, install-service.bat, start/stop, set-backend-url.bat
build-bundle.bat
```

---

## 4. Backend

### 4.1 Configuración tipada desde YAML

```python
# app/core/config.py
from pathlib import Path
from typing import List
import yaml
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/

def build_database_url(db_type: str, host: str, port: int, user: str,
                       password: str, name: str) -> str:
  if db_type == "postgresql":
    # Driver explícito: SQLAlchemy 2.1+ sin sufijo busca psycopg v3.
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"
  if db_type == "sqlite":
    # Ruta absoluta: los servicios arrancan con otro cwd.
    return f"sqlite:///{BASE_DIR / f'{name}.db'}"
  raise ValueError(f"Unsupported database type: {db_type}")

class DatabaseSettings(BaseSettings):
  type: str; host: str; port: int; user: str; password: str; name: str
  @property
  def url(self) -> str:
    return build_database_url(self.type, self.host, self.port,
                              self.user, self.password, self.name)

class JWTSettings(BaseSettings):
  secret_key: str; algorithm: str = "HS256"
  access_token_expire_minutes: int = 15; refresh_token_expire_days: int = 7

class SecuritySettings(BaseSettings):
  jwt: JWTSettings
  encryption_key: str

class ServerSettings(BaseSettings):
  host: str = "0.0.0.0"; port: int = 8000
  ssl_keyfile: str = ""; ssl_certfile: str = ""
  cors_origins: List[str]

class Settings(BaseSettings):
  database: DatabaseSettings
  security: SecuritySettings
  server: ServerSettings

def load_config() -> Settings:
  with open(BASE_DIR / "config.yaml") as f:
    return Settings(**yaml.safe_load(f))

settings = load_config()
```

Al arrancar, loguear un warning si los secretos siguen siendo los placeholders
del ejemplo.

### 4.2 Base de datos

```python
# app/core/database.py
import sqlite3
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings

engine = create_engine(
  settings.database.url,
  connect_args={"check_same_thread": False}
    if settings.database.type == "sqlite" else {},
  pool_pre_ping=True,
)

@event.listens_for(Engine, "connect")
def _sqlite_fk(dbapi_connection, _):
  if isinstance(dbapi_connection, sqlite3.Connection):
    dbapi_connection.execute("PRAGMA foreign_keys=ON")  # off por defecto

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
  pass

def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()
```

Convenciones de modelos:
- PK `id` Integer; `created_at`/`updated_at` con `server_default=func.now()` y
  `onupdate=func.now()`.
- FKs con `ondelete` explícito: `CASCADE` para hijos, `SET NULL` para
  referencias opcionales.
- `relationship("Nombre")` por string; `models/__init__.py` importa todos los
  modelos en orden y `main.py` hace `from . import models` antes de los routers.
- Tablas N:M (roles↔permisos, usuarios↔roles) como `Table(...)` con PK compuesta.

### 4.3 Migraciones (Alembic)
- `alembic/env.py` toma la URL de `settings` y permite sobreescribirla con una
  variable de entorno (útil para crear el esquema en otra base al migrar de
  motor).
- Importar todos los modelos en `env.py` para que funcione `--autogenerate`.
- Escribir migraciones **portables SQLite/PostgreSQL**: `op.batch_alter_table`
  para alterar columnas en SQLite, defaults booleanos con
  `sa.text("true")`/`sa.false()` compatibles, nada de SQL crudo de un solo
  dialecto. Probarlas contra ambos motores.

### 4.4 Seguridad

```python
# app/core/security.py
import base64, hashlib
from datetime import datetime, timedelta, timezone
import bcrypt
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from .config import settings

def get_password_hash(p: str) -> str:
  return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, hashed: str) -> bool:
  return bcrypt.checkpw(p.encode(), hashed.encode())

def _token(data: dict, delta: timedelta) -> str:
  payload = {**data, "exp": datetime.now(timezone.utc) + delta}
  return jwt.encode(payload, settings.security.jwt.secret_key,
                    algorithm=settings.security.jwt.algorithm)

def create_access_token(data: dict) -> str:
  return _token(data, timedelta(
    minutes=settings.security.jwt.access_token_expire_minutes))

def create_refresh_token(data: dict) -> str:
  return _token(data, timedelta(
    days=settings.security.jwt.refresh_token_expire_days))

def decode_token(token: str) -> dict | None:
  try:
    return jwt.decode(token, settings.security.jwt.secret_key,
                      algorithms=[settings.security.jwt.algorithm])
  except JWTError:
    return None

# Secretos guardados en BD: Fernet (AES-128-CBC + HMAC-SHA256, autenticado).
_key = base64.urlsafe_b64encode(
  hashlib.sha256(settings.security.encryption_key.encode()).digest())
_cipher = Fernet(_key)

def encrypt_sensitive_data(s: str) -> str:
  return _cipher.encrypt(s.encode()).decode()

def decrypt_sensitive_data(s: str) -> str:
  return _cipher.decrypt(s.encode()).decode()
```

Recomendaciones:
- La clave de cifrado debe ser aleatoria (32 bytes); si puede ser elegida por
  humanos, usar un KDF lento (scrypt/PBKDF2) en lugar de SHA-256.
- Usar `MultiFernet` si se necesita rotar la clave.
- Proteger `config.yaml` con permisos de sistema de archivos: contiene la clave
  y suele estar junto a la base.

### 4.5 Autenticación y autorización
- `POST /api/auth/login` con `OAuth2PasswordRequestForm` (form-urlencoded),
  rate limit (p. ej. `10/minute`), devuelve `access_token` + `refresh_token`
  (`sub = user_id`).
- `POST /api/auth/refresh` rota ambos tokens.
- Header `Authorization: Bearer` vía `HTTPBearer`; en WebSocket, `?token=`.

```python
# app/core/deps.py (esqueleto)
security = HTTPBearer()

async def get_current_user(creds=Depends(security), db=Depends(get_db)):
  payload = decode_token(creds.credentials)
  user = payload and db.get(User, int(payload.get("sub", 0)))
  if not user:
    raise HTTPException(401, "Could not validate credentials",
                        headers={"WWW-Authenticate": "Bearer"})
  return user

async def get_current_active_user(u=Depends(get_current_user)):
  if not u.is_active:
    raise HTTPException(400, "Inactive user")
  return u

async def get_current_admin_user(u=Depends(get_current_active_user)):
  if not u.is_admin:
    raise HTTPException(403, "Not enough permissions")
  return u

def require_permission(name: str):
  async def checker(u=Depends(get_current_active_user), db=Depends(get_db)):
    if u.is_admin:          # bypass explícito: funciona sin roles sembrados
      return u
    if name not in get_user_permissions(db, u.id):
      raise HTTPException(403, f"Permission required: {name}")
    return u
  return checker
```

- **RBAC**: `User *─* Role *─* Permission`. Permisos con nombre
  `<recurso>_<acción>` y categoría. Roles y permisos por defecto definidos como
  constantes en el modelo y sembrados con un script idempotente.
- **ACL por ámbito** (opcional): tabla `user_<ámbito>` (p. ej. sitio, área,
  cliente). `None` = sin restricción; recursos sin ámbito son visibles para
  todos. Filtrar en las queries de listado y validar en los endpoints de detalle.
- Script `create_admin.py` para el primer usuario.

### 4.6 Routers

Un archivo por recurso, montado con prefijo `/api/<recurso>`:

```python
router = APIRouter()

@router.get("", response_model=List[ItemResponse])
def list_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db),
               user=Depends(require_permission("item_read"))):
  return crud.get_items(db, skip=skip, limit=limit)

@router.post("", response_model=ItemResponse, status_code=201)
def create_item(data: ItemCreate, background_tasks: BackgroundTasks,
                db: Session = Depends(get_db),
                user=Depends(require_permission("item_create"))):
  item = crud.create_item(db, data, created_by=user.id)
  background_tasks.add_task(fire_event, db, "item.created", {"id": item.id})
  return item
```

- Schemas: `ItemCreate`, `ItemUpdate` (todo opcional), `ItemResponse` con
  `model_config = ConfigDict(from_attributes=True)`.
- Routers delgados; la lógica va en `crud/` o `utils/`.
- Endpoints estándar adicionales: `/api/health` (`{status, version, db}`,
  ejecuta `SELECT 1`), import/export CSV/JSON, búsqueda global, dashboard.
- Docs en `/api/docs`, `/api/redoc`, `/api/openapi.json` (todo bajo `/api` para
  poder poner un reverse proxy delante con una sola regla).

### 4.7 `main.py`: middlewares y handlers

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
  warn_if_placeholder_secrets()
  start_scheduler()
  yield
  shutdown_scheduler()

app = FastAPI(title="My App API", version="1.0.0", lifespan=lifespan,
              docs_url="/api/docs", redoc_url="/api/redoc",
              openapi_url="/api/openapi.json")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=settings.server.cors_origins,
                   allow_credentials=True, allow_methods=["*"],
                   allow_headers=["*"])
app.add_middleware(AuditMiddleware)

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
  # Sin headers CORS, el navegador muestra "error de CORS" en vez del 500.
  origin = request.headers.get("origin", "")
  headers = ({"Access-Control-Allow-Origin": origin,
              "Access-Control-Allow-Credentials": "true"}
             if origin in settings.server.cors_origins else {})
  return JSONResponse(status_code=500,
                      content={"detail": "Internal server error"},
                      headers=headers)
```

**Auditoría** (`BaseHTTPMiddleware`): para POST/PUT/PATCH/DELETE en rutas
mapeadas por regex a un tipo de recurso, lee el body (redactando `password`,
`secret`, `token`), opcionalmente captura el estado previo para calcular un diff
por campo, y si la respuesta es 2xx inserta un registro de auditoría con su
propia sesión (usuario extraído del JWT, IP, user-agent, endpoint, status).

### 4.8 Jobs en background
- `APScheduler.BackgroundScheduler` con `ThreadPoolExecutor(5)`,
  `coalesce=True`, `max_instances=1`, `misfire_grace_time=60`; arrancado y
  detenido en el `lifespan`.
- Cada job abre y cierra su propia `SessionLocal()`, hace `rollback` ante error.
- Configuración de los jobs (habilitado, intervalo, retención) guardada en
  tablas de config de una sola fila, editables desde la UI.
- Jobs típicos: chequeos periódicos, backup programado (copia gzip de SQLite o
  `pg_dump`) con retención, limpieza de históricos.
- Paralelismo para operaciones de E/S masivas: `ThreadPoolExecutor` local.

### 4.9 Tiempo real (WebSocket por topics)

```python
class ConnectionManager:
  def __init__(self): self.connections: dict[str, set[WebSocket]] = {}
  async def connect(self, ws, topics):
    await ws.accept()
    for t in topics: self.connections.setdefault(t, set()).add(ws)
  def disconnect(self, ws):
    for t in list(self.connections):
      self.connections[t].discard(ws)
      if not self.connections[t]: del self.connections[t]
  async def broadcast(self, topic, message):
    for ws in list(self.connections.get(topic, ())):
      try: await ws.send_json(message)
      except Exception: self.disconnect(ws)

manager = ConnectionManager()
```

- Endpoint `/ws?token=JWT&topics=a,b`: valida el token antes de aceptar (cierra
  con código 4001), responde `"pong"` a `"ping"`.
- Desde hilos (jobs) publicar con `asyncio.run_coroutine_threadsafe`.
- Los mensajes son **señales** (`{"type": "x_updated"}`): el cliente invalida
  queries y vuelve a pedir datos por REST. Así no se duplica lógica de
  serialización ni de permisos.

### 4.10 Webhooks salientes
Tabla de configuración (url, eventos suscritos, secret, enabled). `fire_event`
se ejecuta en `BackgroundTasks`, hace POST JSON con `httpx` (timeout corto) y
firma el body con HMAC-SHA256 en un header si hay secret.

### 4.11 Tests

```python
@pytest.fixture(autouse=True)
def reset_rate_limiter():
  limiter.reset(); yield; limiter.reset()   # el limiter es singleton

@pytest.fixture()
def db_session():
  engine = create_engine("sqlite:///:memory:",
                         connect_args={"check_same_thread": False},
                         poolclass=StaticPool)
  Base.metadata.create_all(engine)
  TestSession = sessionmaker(bind=engine)
  original = audit_module.SessionLocal
  audit_module.SessionLocal = TestSession   # el middleware usa su propia sesión
  s = TestSession()
  yield s
  s.close(); audit_module.SessionLocal = original

@pytest.fixture()
def client(db_session):
  app.dependency_overrides[get_db] = lambda: (yield db_session)
  yield TestClient(app)
  app.dependency_overrides.clear()
```

Fixtures adicionales: usuario admin, usuario sin permisos, headers con token,
roles sembrados. Cubrir autorización (403) además del camino feliz, y limpiar
archivos que los endpoints escriban en disco.

### 4.12 Convenciones Python
2 espacios de indentación (o 4, pero uniforme), líneas ≤ 88, type hints en
todas las funciones, imports relativos dentro del paquete `app`.

---

## 5. Frontend

### 5.1 Layout raíz

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/runtime-config.js" />
        <script dangerouslySetInnerHTML={{ __html:
          `(function(){try{if(localStorage.getItem('theme')==='dark')` +
          `document.documentElement.classList.add('dark')}catch(e){}})()` }} />
      </head>
      <body className={inter.className}>
        <QueryProvider>
          <I18nProvider>
            <AuthGuard>
              <AppShell>{children}</AppShell>
            </AuthGuard>
          </I18nProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

- `QueryProvider`: `QueryClient` en `useState`, `staleTime: 60_000`,
  `refetchOnWindowFocus: false`.
- `AuthGuard`: si no hay `access_token` en `localStorage` y la ruta no es
  pública, `router.replace("/login")`; renderiza `null` hasta verificar.
- `AdminGuard`: consulta `/api/auth/me` y bloquea páginas solo-admin (defensa en
  profundidad; el backend sigue siendo la barrera real).
- `AppShell`: navbar superior o sidebar colapsable, elegible por el usuario y
  persistido en `localStorage`.

### 5.2 URL del backend en runtime (obligatorio)

```js
// public/runtime-config.js  — reescrito por el instalador
window.__RUNTIME_CONFIG__ = { apiUrl: "http://BACKEND_URL_PLACEHOLDER" };
```

```ts
// src/lib/config.ts
const PLACEHOLDER = "BACKEND_URL_PLACEHOLDER";
declare global { interface Window { __RUNTIME_CONFIG__?: { apiUrl?: string } } }
const usable = (u?: string): u is string => !!u && !u.includes(PLACEHOLDER);

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const u = window.__RUNTIME_CONFIG__?.apiUrl;
    if (usable(u)) return u.replace(/\/$/, "");
  }
  const b = process.env.NEXT_PUBLIC_API_URL;
  return usable(b) ? b.replace(/\/$/, "") : "http://localhost:8000";
}
```

```js
// next.config.js
module.exports = {
  output: "standalone",
  async headers() {
    return [{ source: "/runtime-config.js",
              headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] }];
  },
};
```

Por qué: los chunks de `/_next/static` se sirven con `Cache-Control: immutable`
y su nombre se calcula en el build. Si la URL se inyecta parcheando esos
archivos después del build, los navegadores que ya visitaron una instalación
anterior siguen usando la URL vieja (síntoma típico: "no se puede conectar al
backend" que funciona en incógnito). Reglas:
- Nunca leer `process.env.NEXT_PUBLIC_API_URL` fuera de `getApiUrl()`.
- Llamar `getApiUrl()` en cada request, no al cargar el módulo.
- El esquema del WebSocket sale de la URL del backend
  (`https → wss`), no del de la página.

### 5.3 Cliente HTTP

```ts
// src/lib/api.ts
const api = axios.create({ headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  config.baseURL = getApiUrl();
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((r) => r, async (error) => {
  const original = error.config;
  const isLogin = original?.url?.includes("/api/auth/login");
  if (error.response?.status === 401 && !original._retry && !isLogin) {
    original._retry = true;
    try {
      const params = new URLSearchParams({
        refresh_token: localStorage.getItem("refresh_token") ?? "" });
      const { data } = await axios.post(`${getApiUrl()}/api/auth/refresh`, params);
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (e) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      if (!location.pathname.includes("/login")) location.href = "/login";
      return Promise.reject(e);
    }
  }
  return Promise.reject(error);
});
export default api;
```

### 5.4 Servicios, tipos y queries
- `src/types/index.ts`: interfaces espejo de los schemas Pydantic
  (`Item`, `ItemCreate`, `ItemUpdate`).
- `src/lib/services.ts`: un objeto por recurso con funciones tipadas:

```ts
export const itemService = {
  getItems: async (params?: { skip?: number; limit?: number }) =>
    (await api.get<Item[]>("/api/items", { params })).data,
  createItem: async (data: ItemCreate) =>
    (await api.post<Item>("/api/items", data)).data,
};
```

- En páginas:

```tsx
const { data: items = [], isLoading } = useQuery({
  queryKey: ["items", filters], queryFn: () => itemService.getItems(filters) });
const create = useMutation({
  mutationFn: itemService.createItem,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }) });
```

- Hook `useWebSocket(topics)`: conecta con el token, keepalive cada 30 s,
  reconexión a los 5 s, y por cada mensaje invalida las query keys asociadas al
  topic.

### 5.5 Login
Formulario + indicador de estado del backend: `fetch(getApiUrl() + "/api/health")`
con `AbortController` (timeout de 5 s) que muestra versión, estado de la BD, un
botón de reintentar y, si la URL es `https`, una pista para aceptar el
certificado autofirmado. Distinguir error de red (sin `response`) de
credenciales inválidas (401/422) y de error de servidor.

### 5.6 i18n, tema, preferencias
- i18n mínimo propio: un JSON anidado por idioma, `t("seccion.clave", {param})`,
  fallback al idioma por defecto y luego a la key; idioma en `localStorage`.
- Tema: clase `dark` en `<html>`, `localStorage.theme`, script inline en el
  `<head>` para evitar parpadeo, sincronizado entre componentes con un
  `CustomEvent`.
- Preferencias de UI (layout, columnas visibles, sidebar) en `localStorage`.

### 5.7 Convenciones
`"use client"` en componentes con hooks; imports con alias `@/*`; query keys
siempre arrays; un único set de iconos; componentes shadcn en `components/ui`
sin modificar su API.

---

## 6. Despliegue offline en Windows

### 6.1 Build del bundle (máquina con internet) — `build-bundle.bat`
1. Descargar Python embeddable; reescribir `pythonXY._pth` con
   `pythonXY.zip`, `.`, `import site`, `Lib\site-packages` (sin esto no hay
   site-packages); instalar pip con `get-pip.py`.
2. `pip download -r requirements.txt -d runtime\python-wheels
   --only-binary=:all: --platform win_amd64 --python-version 3.11`.
3. Descargar Node portable y NSSM.
4. Build del frontend con `NEXT_PUBLIC_API_URL` placeholder; copiar
   `.next\standalone\*`, **además** `.next\static` → `.next\static` y
   `public\` → `public\` (standalone no los incluye).
5. Copiar backend (app, alembic, scripts Python), `scripts\*.bat`, docs; zip.

### 6.2 Instalación (sin internet, como Administrador) — `install.bat`
1. Verificar privilegios (`net session`); preguntar directorio destino.
2. Copiar runtime y app.
3. `pip install --no-index --find-links=runtime\python-wheels -r requirements.txt`.
4. Generar `config.yaml` con secretos aleatorios (PowerShell
   `RandomNumberGenerator`) y la IP detectada en `cors_origins`.
5. `alembic upgrade head`.
6. Generar certificado autofirmado (`cryptography`: RSA-2048, SAN
   `localhost`, `127.0.0.1` e IP del servidor) y habilitar TLS en el backend.
7. Escribir `public\runtime-config.js` con `https://<IP>:<puerto>`.
8. Copiar scripts de operación.

### 6.3 Servicios con NSSM — `install-service.bat`

```bat
nssm install MyApp-Backend "%PYTHON%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile "%KEY%" --ssl-certfile "%CRT%"
nssm set MyApp-Backend AppDirectory "%INSTALL_DIR%\app\backend"
nssm install MyApp-Frontend "%NODE%" server.js
nssm set MyApp-Frontend AppDirectory "%INSTALL_DIR%\app\frontend"
nssm set MyApp-Frontend AppEnvironmentExtra NODE_ENV=production PORT=3000
REM En ambos:
nssm set <svc> Start SERVICE_AUTO_START
nssm set <svc> AppStdout "%LOG_DIR%\<svc>-stdout.log"
nssm set <svc> AppStderr "%LOG_DIR%\<svc>-stderr.log"
nssm set <svc> AppRotateFiles 1
nssm set <svc> AppRotateBytes 10485760
nssm set <svc> AppRestartDelay 5000
```

### 6.4 Operación
- `set-backend-url.bat`: reescribe `runtime-config.js`; aplica con F5.
- Scripts `start.bat`/`stop.bat` para correr sin servicios.
- Primera vez, el usuario abre `https://<IP>:<puerto>/api/health` para aceptar
  el certificado autofirmado (o se instala el cert en el almacén de confianza).
- Actualizaciones: bundles parciales (solo backend o solo frontend) que
  reemplazan `app\` conservando `config.yaml`, la base, `ssl\` y
  `runtime-config.js`.

---

## 7. Errores conocidos a evitar

1. Inyectar configuración en assets con hash e `immutable` → usar
   `runtime-config.js` sin cache.
2. `postgresql://` sin driver en SQLAlchemy 2.1+ → usar `postgresql+psycopg2://`.
3. SQLite sin `PRAGMA foreign_keys=ON` → los `ondelete` no se aplican.
4. Rutas de SQLite relativas al cwd → la base aparece en otro directorio al
   correr como servicio.
5. Migraciones con SQL de un solo dialecto → rompen al cambiar de motor.
6. Handler de 500 sin headers CORS → el frontend ve un error de CORS engañoso.
7. Middleware con sesión propia no redirigida en tests → escribe en la base real.
8. Rate limiter singleton sin reset entre tests → fallos intermitentes de login.
9. Permisos que dependen de datos sembrados → el admin queda afuera en una
   instalación nueva; usar bypass explícito por `is_admin`.
10. WebSocket con `ws:` derivado del protocolo de la página cuando el backend es
    `https` → conexión fallida.
11. Python embeddable sin editar `._pth` → no encuentra los paquetes instalados.
12. Copiar solo `.next/standalone` → faltan `static` y `public`.

---

## 8. Receta de bootstrap

1. Crear la estructura de §3. Copiar `core/` (§4.1–4.5) y `main.py` (§4.7).
2. `config.yaml.example` con secciones `database`, `security`, `server`,
   `rate_limit` y secretos placeholder.
3. Modelos `User`, `Role`, `Permission`, tablas N:M y registro de auditoría;
   `alembic init`, ajustar `env.py`, migración inicial.
4. Router `auth` (login, refresh, me, CRUD usuarios); scripts `create_admin.py`
   y `seed_roles.py`; `conftest.py` de §4.11.
5. Por cada recurso de dominio: modelo → schemas → crud → router con
   `require_permission` → `include_router` → tests → tipos TS → servicio → página.
6. Frontend: `create-next-app` (TypeScript, Tailwind, App Router, `src/`),
   `shadcn init`, componentes base (button, card, dialog, input, label, select,
   table, tabs, badge, checkbox, switch, popover, command); `next.config.js`,
   `runtime-config.js`, `config.ts`, `api.ts`, providers, guards, shell, login.
7. Opcionales según necesidad: scheduler, WebSocket, webhooks, import/export,
   backups, i18n, ACL por ámbito.
8. Scripts de bundle, instalación y servicios de §6, ajustando nombres y puertos.
