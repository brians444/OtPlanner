# PlannerOT — Documentación del proyecto

Migración completa del planificador monolítico `base_docs/Kanban.html` (HTML + JS vanilla que
persistía en `bd.xlsx` mediante File System Access API) a una aplicación web cliente/servidor
con base de datos real, autenticación, tiempo real y API REST.

- **Fecha de entrega:** 2026-11-17
- **Documentos base vinculantes:** `base_docs/arch.md` (plantilla de arquitectura FastAPI + Next.js
  offline-Windows) y `base_docs/style.md` (sistema visual Next 16 + React 19 + Tailwind 3 + shadcn/ui).
- **Paridad funcional:** todas las funciones de `Kanban.html` están reproducidas (ver §16).
- **Privacidad de datos:** el repositorio contiene exclusivamente datos ficticios
  (`base_docs/demo.xlsx`, generado por `scripts/generate_demo_xlsx.py`) y capturas tomadas con
  ese dataset. El Excel real del negocio (`bd.xlsx`) está ignorado por git y no se publica.

---

## 1. Stack y librerías

### Backend (`backend/`, Python 3.13)

| Librería | Versión | Rol |
|---|---|---|
| fastapi | 0.141.1 | API REST + WebSocket, inyección de dependencias, OpenAPI |
| uvicorn[standard] | 0.34.0 | Servidor ASGI (httptools + websockets) |
| sqlalchemy | 2.0.36 | ORM 2.0 (`Mapped` / `mapped_column`), SQLite con `PRAGMA foreign_keys=ON` |
| alembic | 1.14.0 | Reservado para migraciones de esquema (hoy `create_all` + seed idempotente) |
| pydantic | 2.10.4 | Schemas de request/response, validación (`Field`, `model_dump(exclude_unset)`) |
| pydantic-settings | 2.7.0 | Settings tipados por sección sobre `config.yaml` |
| python-jose[cryptography] | 3.3.0 | JWT access/refresh con claim `type` diferenciado |
| bcrypt | 4.2.1 | Hash de contraseñas |
| slowapi | 0.1.9 | Rate limiting (login `10/minute`) |
| python-multipart | 0.0.20 | Login form-urlencoded + upload de Excel |
| pyyaml | 6.0.2 | Lectura de `config.yaml` |
| openpyxl | 3.1.5 | Import/export `.xlsx` con el layout de hojas original |
| httpx | 0.28.1 | `TestClient` de FastAPI en los tests |
| pytest | 8.3.4 | Suite de 24 tests de API y seed |

### Frontend (`frontend/`, Node ≥ 20)

| Librería | Versión | Rol |
|---|---|---|
| next | 16.4.6 | App Router, Turbopack, build estático por ruta |
| react / react-dom | 19 | UI |
| typescript | 5 | Tipado estricto de todo el cliente |
| tailwindcss | 3.4 | Utilidades + tokens HSL semánticos (`tailwind.config.js`) |
| @radix-ui/* (select, tabs, switch, checkbox, dialog, label, progress, slot) | 1.x–2.x | Primitivas accesibles de shadcn/ui |
| @tanstack/react-query | 5 | Única fuente de estado servidor: cache `["snapshot"]`, optimistic updates, invalidación por WebSocket |
| axios | 1.7 | Cliente HTTP con interceptor de refresh token |
| recharts | 3 | Gráficos del dashboard (barras, tortas, carga por responsable) |
| lucide-react | 0.469 | Iconografía |
| class-variance-authority / clsx / tailwind-merge | — | Variantes de componentes (`cn`) |
| date-fns | 3 | Disponible para fechas (el formateo propio vive en `lib/format.ts`) |
| tailwindcss-animate | 1 | Animaciones de entrada de modales/paneles |

No hay estado global duplicado: React Query owns los datos del servidor; `localStorage` owns las
preferencias de UI; el estado efímero (drag, filtros abiertos, modales) vive en componentes.

---

## 2. Arquitectura

```
┌────────────────────────────┐        ┌─────────────────────────────────┐
│  Next.js 16 (App Router)   │  HTTP  │  FastAPI (uvicorn)              │
│  React 19 + Tailwind 3     │◄──────►│  /api/*  REST + /ws  WebSocket  │
│  shadcn/ui + Radix         │  JWT   │  SQLAlchemy 2.0 + Pydantic v2   │
│  TanStack Query (snapshot) │        │  slowapi · bcrypt · jose        │
└────────────────────────────┘        └───────────────┬─────────────────┘
        ▲  runtime-config.js                          │
        │  (API_URL editable sin rebuild)             ▼
   public/ del frontend                     SQLite (plannerot.db)
                                            o PostgreSQL (config.yaml)
                                                      ▲
                                            seed idempotente al arrancar
                                            desde base_docs/demo.xlsx (ficticio)
```

### Flujo de datos

1. **Un solo endpoint de lectura:** `GET /api/snapshot` devuelve todas las entidades
   (proyectos, actividades, comentarios, subtareas, checklist, hitos, etiquetas, listas,
   personal, ausencias, historial). El frontend lo cachea como `["snapshot"]`.
2. **Escrituras granulares:** cada mutación va a su endpoint REST (`POST/PUT/PATCH/DELETE`).
   El backend aplica reglas de negocio, commitea y llama `notify()`.
3. **Tiempo real:** `notify()` programa un broadcast en el event loop de uvicorn
   (`run_coroutine_threadsafe`, porque los endpoints son sync). Todos los clientes conectados a
   `/ws?token=…&topics=data` reciben un ping y hacen `invalidateQueries(["snapshot"])`.
   Varias pestañas/usuarios ven el mismo tablero al instante.
4. **Optimistic updates:** el drag & drop del Kanban muta la cache local antes de la respuesta
   y revierte en `onError` (patrón `onMutate/onError/onSettled` de TanStack Query).

### Capas del backend

- `app/core/` — config (YAML → settings tipados), database (engine/session, `get_db`),
  security (hash bcrypt, create/decode JWT), deps (`get_current_active_user`, `require_admin`),
  rate_limit (slowapi), websocket (hub + `notify`).
- `app/models/` — 12 tablas SQLAlchemy 2.0.
- `app/schemas/` — schemas Pydantic por entidad (`*Create`, `*Update`, `*Response`, `Snapshot`).
- `app/crud/helpers.py` — `next_id` (IDs legibles `PRY-001`, `ACT-001`, `CHK-0001`…),
  `key_of` (normalización sin acentos/mayúsculas), `norm`, `touch`, `log_change`,
  `ensure_catalog`, `checklist_of`, `subs_of`, `acts_of`.
- `app/crud/logic.py` — reglas de negocio: `rollup_project`, cascada finish-to-start,
  `has_cycle`, `validate_act_dates`, `duplicate_project` (remapeo de IDs y dependencias),
  `delete_project_cascade`, `rename_tag_refs` / `remove_tag_refs` / `rename_list_refs`,
  `recalc_all_acts`.
- `app/api/` — un router por recurso; todos notifican por WebSocket tras commitear.
- `app/utils/` — `seed.py` (carga idempotente de `demo.xlsx` + admin), `excel_import.py`,
  `excel_export.py`.
- `app/main.py` — lifespan (warn de secrets placeholder → seed → set loop), CORS desde config,
  montaje de routers, `/api/health`, `/ws` con validación de JWT (close 4401 si inválido/inactivo).

### Capas del frontend

- `src/lib/` — `api.ts` (axios + refresh interceptor + tokens en localStorage),
  `services.ts` (un servicio por recurso), `types.ts` (espejo de los schemas + catálogos),
  `format.ts` (fechas es-AR, `keyOf`, `isFinalEstado`…), `colors.ts` (paletas de estado,
  prioridad, demanda, ausencias; `riskInfo` vencido/por vencer).
- `src/hooks/` — `use-snapshot` (query + WebSocket con reconexión), `use-auth`,
  `use-board-filters`, `use-theme`, `use-nav-layout`, `use-table-style`.
- `src/components/ui/` — primitivas shadcn/ui del preset de `style.md`.
- `src/components/board/` — KPIs, barra de filtros (10 multi-select + AND/OR de etiquetas +
  búsqueda + rango de fechas), tarjeta de proyecto, modal WIP.
- `src/components/project/` — modal de proyecto (shell con tabs), Gantt interactivo
  (`gantt-panel`, `gantt-parts`, `gantt-shared`), checklist unificado, comentarios/chat,
  notas y enlaces, historial, formularios de proyecto/actividad/hito.
- `src/components/personal/` — modal de persona y panel de ausencias con matemática de francos.
- `src/app/(app)/` — grupo de rutas protegidas por el guard de auth del layout; `login/` pública.

---

## 3. Estructura del repositorio

```
PlannerOT/
├── Project.md                  ← este documento
├── README.md                   ← presentación del repositorio
├── .gitignore
├── base_docs/
│   ├── Kanban.html             ← monolito original (referencia de paridad)
│   ├── demo.xlsx               ← dataset ficticio (fuente del seed y de las capturas)
│   ├── arch.md                 ← plantilla de arquitectura vinculante
│   └── style.md                ← sistema visual vinculante
├── scripts/
│   └── generate_demo_xlsx.py   ← generador determinista del dataset demo
├── docs/screenshots/           ← capturas de la app con datos ficticios
├── backend/
│   ├── config.yaml.example     ← plantilla de configuración (commiteada)
│   ├── config.yaml             ← configuración local (NO commiteada: contiene el secret JWT)
│   ├── requirements.txt
│   ├── app/…                   ← código (ver §2)
│   └── tests/                  ← pytest: test_api.py, test_seed.py, conftest.py
└── frontend/
    ├── package.json / package-lock.json
    ├── next.config.mjs / tailwind.config.js / tsconfig.json / postcss.config.js
    ├── public/runtime-config.js← API_URL en runtime, editable sin rebuild
    └── src/…                   ← código (ver §2)
```

`plannerot.db`, `node_modules/`, `.next/`, `.venv/` y `__pycache__/` están ignorados por git.

---

## 4. Modelo de datos (12 tablas)

| Tabla | PK | Campos destacados |
|---|---|---|
| `users` | int | username, password_hash, display_name, is_admin, is_active |
| `proyectos` | `PRY-nnn` | proyecto, descripcion, responsable, responsable_tecnico, project_leader, area, yacimiento, instalacion, estado, prioridad, fecha_inicio, fecha_fin_estimada, avance, sprint, fase, etiqueta_1..5, comentarios, enlaces, modo_tareas (`Gantt`/`Checklist`), ultima_actualizacion |
| `actividades` | `ACT-nnn` | proyecto_id, actividad, fecha_inicio, fecha_fin, avance, etiqueta, estado, depende_de, peso, orden |
| `comentarios` | `CH-nnnn`* | actividad_id (vacío = chat de proyecto), proyecto_id, autor, fecha_hora, comentario |
| `subtareas` | `SUB-nnn` | actividad_id, proyecto_id, texto, hecha, orden, horas_est, demanda |
| `checklist_items` | `CHK-nnnn` | proyecto_id, texto, hecha, orden, horas_est, demanda |
| `hitos` | `HITO-nnn` | proyecto_id, hito, fecha, estado (`Pendiente`/`Cumplido`) |
| `etiquetas` | `ET-nn` | etiqueta, categoria, color_hex, activa |
| `listas_valores` | int | catalog, value, position |
| `personal` | `PER-nnn` | nombre, puesto, area, legajo, base, francos_disponibles, francos_generados, notas |
| `ausencias` | `AUS-nnn` | persona_id, tipo, desde, hasta, notas |
| `historial_cambios` | `CH-nnnn` | proyecto_id, campo, valor_anterior, valor_nuevo, usuario, fecha_hora |

\* Los comentarios usan su propio prefijo de ID; el historial usa `CH-` con padding 4.
Los IDs se generan con `next_id()` (scan del máximo existente + 1), legibles y estables,
igual que en el monolito original.

Catálogos de `listas_valores`: `Estado`, `Prioridad`, `Area`, `Sprint`, `Fase`, `Responsable`,
`Responsable_Tecnico`, `Project_Leader`, `Yacimiento`, `Instalacion`.

---

## 5. Reglas de negocio

- **Rollup de avance:** en modo Gantt el avance del proyecto es el promedio ponderado por `peso`
  de sus actividades; en modo Checklist es el porcentaje de ítems hechos. Marcar un estado final
  (`Completado`/`Cancelado`) fuerza avance 100.
- **Modo Checklist:** al elegirlo se limpian `fecha_inicio`/`fecha_fin_estimada` del proyecto
  (el checklist no tiene fechas); el tablero y el Gantt global lo excluyen de las vistas de fechas.
- **Cascada de dependencias:** finish-to-start. Mover una actividad `delta_days` arrastra a sus
  dependientes para que empiecen como mínimo al día siguiente del fin de su predecesora;
  `has_cycle` rechaza dependencias circulares; `recalc-acts` reaplica la cascada a todo el proyecto.
- **Límite de actividades:** máximo 10 por proyecto (paridad con el original).
- **Duplicar proyecto:** copia actividades (con remapeo de IDs y de `depende_de`), checklist,
  hitos y etiquetas; el historial registra "Duplicado de PRY-xxx".
- **Eliminar proyecto:** cascade explícito de actividades, comentarios (de proyecto y de
  actividad), subtareas, checklist e hitos + registro en historial.
- **Propagación de renombrados:** renombrar una etiqueta o un valor de lista actualiza todas las
  referencias en proyectos y actividades; eliminar una etiqueta limpia sus referencias y eliminar
  un valor de lista limpia el campo correspondiente.
- **Normalización:** `key_of` compara sin acentos ni mayúsculas en estados, etiquetas, catálogos
  y búsquedas (paridad con `keyOf` del original).
- **Francos (calculados en frontend):** `usados` = Σ días de ausencias tipo `Franco`;
  `genAuto` = Σ días de tipo `Franco Generado`; `generados` = `francos_generados` manual + `genAuto`;
  `restantes` = generados − usados. Tipos válidos: `Vacaciones`, `Trámite`, `Franco`, `Franco Generado`;
  `hasta ≥ desde` validado en backend.
- **Riesgo de fechas:** `riskInfo` marca *Vencido (Nd)* si la fin estimada pasó y el estado no es
  final, o *Vence en Nd* si faltan ≤ 3 días.
- **WIP:** límites por columna persistidos en `localStorage` (`kanbanWIP`); la cabecera de la
  columna muestra `n/límite` y pulsa en rojo al excederse.
- **Historial:** cada cambio de campo auditado (`HIST_FIELDS`) con usuario, fecha y valor
  anterior/nuevo; los cambios múltiples en un request generan un registro único por campo.

---

## 6. API REST

Prefijo `/api`. Todo requiere JWT salvo `auth/login`, `auth/refresh` y `health`.
Los endpoints marcados 🔒 requieren `is_admin`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Form-urlencoded → access + refresh (rate limit 10/min) |
| POST | `/auth/refresh` | Refresh token → nuevo access |
| GET | `/auth/me` | Usuario actual |
| GET/POST/PUT/DELETE | `/users` 🔒 | Gestión de cuentas |
| GET | `/snapshot` | Todas las entidades en una respuesta |
| GET | `/health` | Estado del servicio |
| POST/PUT/DELETE | `/proyectos`, `/proyectos/{id}` | CRUD con validación de fechas y rollup |
| PATCH | `/proyectos/{id}/estado` | Cambio de estado (fuerza 100% si es final) |
| PUT | `/proyectos/{id}/notes` | Comentarios + enlaces |
| POST | `/proyectos/{id}/duplicate` | Copia completa con remapeo de IDs |
| POST | `/proyectos/{id}/recalc-acts` | Reaplica cascada de dependencias |
| POST/PUT/DELETE | `/actividades`, `/actividades/{id}` | CRUD (máx. 10 por proyecto) |
| POST | `/actividades/{id}/move` | `{delta_days}` → mueve y cascadea |
| POST | `/actividades/reorder` | `{ids}` reordena filas |
| POST | `/actividades/{id}/done` | Marca 100% / reabre |
| POST | `/actividades/{id}/apply-checklist` | Avance = % de subtareas hechas |
| POST/PUT/DELETE | `/comentarios` | Comentarios de actividad y chat de proyecto |
| POST/PUT/DELETE | `/checklist`, `/subtareas` | Ítems con `horas_est` y `demanda` |
| POST | `/checklist/reorder`, `/subtareas/reorder` | Reordenamiento |
| POST/PUT/DELETE | `/hitos` | Hitos con fecha y estado |
| POST/PUT/DELETE | `/etiquetas` | Con propagación de renombrado/borrado |
| POST/PUT/DELETE | `/listas`, `/listas/reorder` | Catálogos con propagación |
| POST/PUT/DELETE | `/personal`, `/ausencias` | Equipo y ausencias (tipos validados) |
| GET/DELETE | `/historial` | Auditoría global o por proyecto; 🔒 para borrar |
| GET | `/excel/export` | `.xlsx` con las 11 hojas originales |
| POST | `/excel/import?replace=true` 🔒 | Reemplaza la base desde un `.xlsx` |
| WS | `/ws?token=…&topics=data` | Broadcast de invalidación tras cada commit |

---

## 7. Frontend: rutas, estado y preferencias

| Ruta | Contenido |
|---|---|
| `/login` | Autenticación (pública) |
| `/tablero` | Kanban con DnD, KPIs, 10 filtros multi-select, AND/OR de etiquetas, búsqueda, rango de fechas, WIP, impresión |
| `/gantt` | Gantt global: una fila por proyecto con fechas, hitos ◆, fila de ausencias del equipo, zoom y ancho de columna, filtros |
| `/dashboard` | KPIs + 4 gráficos recharts + lista de vencidos/por vencer + horas de checklist |
| `/etiquetas` | ABM con color, categoría, activa, conteo de usos y propagación |
| `/listas` | 10 catálogos: agregar, renombrar (propaga), reordenar, eliminar (limpia campo) |
| `/personal` | Equipo + ausencias por persona + francos G/U/R |
| `/historial` | Auditoría global con filtro por proyecto |
| `/usuarios` 🔒 | Cuentas, roles, activación |
| `/configuracion` | Tema, layout de navegación, estilo de tablas, export/import Excel, URL de API |

**Modal de proyecto** (desde cualquier vista): cabecera con estado editable, prioridad, etiquetas,
avance y acciones (editar/duplicar/eliminar); tabs **Gantt o Checklist** según `modo_tareas`,
**Notas y chat** (notas + enlaces `Título | URL` + chat de proyecto) e **Historial**.
El Gantt de proyecto incluye arrastre de barras con cascada, líneas de dependencia SVG con
flecha, reordenamiento de filas, hitos, fila de ausencias, controles de zoom (6–60 px/día) y
ancho de columna (120–600 px), banda de fines de semana y línea de hoy.

**Preferencias en `localStorage`:** `theme`, `nav_layout` (+`_collapsed`), `table_style`,
`kanbanWIP`, `kanbanFiltersOpen`, `ganttDayPx`, `ganttActW`, `plannerot_access`, `plannerot_refresh`.

**Auth en cliente:** interceptor axios que ante 401 intenta `refresh` una vez y reintenta;
si falla, limpia tokens y redirige a `/login`. El WebSocket se reconecta cada 3 s salvo
close 4401 (token inválido).

---

## 8. Sistema visual (style.md)

- Tokens HSL semánticos (`--background`, `--card`, `--primary`, `--muted`, `--destructive`…)
  con variante `.dark` en `<html>`; tipografía Inter.
- Paleta propia del dominio: estados Kanban (`#495057`, `#2C7BE5`, `#7048E8`, `#e8590c`,
  `#2b8a3e`, `#868e96` + paleta de 10 colores para estados custom), prioridad/demanda
  (rojo/naranja/verde), ausencias (cian/violeta/naranja/verde), riesgo naranja `#e8590c`.
- Navegación conmutable **barra superior / sidebar** (colapsable), persistida; navbar sticky.
- Selector de **4 estilos de tabla** (estándar, alternado, con bordes, compacto) aplicado en
  etiquetas, personal y usuarios.
- Modales con overlay propio y portales anidados `z-[60]` (confirmaciones sobre modales).
- Scrollbars teñidas con los tokens del tema; estilos `@media print` que ocultan controles
  (`no-print`) y dejan el tablero/Gantt imprimibles en blanco y negro.
- Microinteracciones: ring en columna al arrastrar, pulso rojo al exceder WIP, hover en filas
  de Gantt que revela acciones, feedback de guardado en notas, badges de conteo en vivo.

---

## 9. Excel: interoperabilidad con el Planner original

Hojas (idéntico layout al Excel original del monolito): `Proyectos`, `Actividades`, `Etiquetas`, `Listas`,
`Comentarios_Act`, `Historial_Cambios`, `Subtareas`, `Hitos`, `Personal`, `Ausencias`,
`Checklist_Proyecto`.

- **Export** (`GET /api/excel/export`): streaming de un `.xlsx` generado con openpyxl, con
  formatos de fecha/hora/porcentaje por columna.
- **Import** (`POST /api/excel/import?replace=true`, solo admin): reemplaza toda la base leyendo
  las mismas hojas; normaliza con `key_of`/`norm` y regenera IDs y catálogos.
- **Seed de arranque:** si la base está vacía, `seed.py` carga `demo.xlsx` (ruta configurable en
  `config.yaml`; puede apuntarse a un Excel propio) y crea el usuario admin. Es idempotente:
  reiniciar no duplica datos. El dataset demo se regenera con
  `python scripts/generate_demo_xlsx.py` (semilla fija, reproducible).

---

## 10. Seguridad

- Contraseñas con bcrypt; JWT HS256 con claim `type` (`access` 60 min / `refresh` 7 días).
- RBAC: `require_admin` en gestión de usuarios, import de Excel y borrado de historial.
- Rate limit de login `10/minute` (slowapi).
- CORS restringido a los orígenes de `config.yaml`.
- WebSocket autenticado por query token; cierra con código 4401 si el token es inválido o el
  usuario está inactivo.
- Validación Pydantic en todos los bodies (longitudes, rangos de avance 0–100, pesos ≥ 0,
  fechas coherentes, tipos de ausencia cerrados).
- `config.yaml` real (con el secret JWT generado) **no se commitea**; se versiona
  `config.yaml.example`. Al arrancar con secrets placeholder se emite warning explícito.

---

## 11. Configuración y puesta en marcha

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Windows
copy config.yaml.example config.yaml                 # y editar secret JWT / CORS / seed
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`config.yaml` (ver `config.yaml.example`): `database` (sqlite o postgresql+psycopg2),
`security.jwt`, `server` (host/puerto/SSL/CORS), `seed` (ruta del Excel y credenciales admin),
`rate_limit`. Cambiar `database.type` a `postgresql` apunta el mismo ORM a Postgres sin tocar código.

### Frontend

```bash
cd frontend
npm install
npm run dev        # desarrollo (Turbopack) → http://localhost:3000
npm run build && npm start   # producción
```

La URL del backend se lee en runtime de `public/runtime-config.js`
(`window.__PLANNEROT_CONFIG__.API_URL`): se puede cambiar sin rebuild, patrón de `arch.md`.

### Credenciales iniciales

`admin` / `admin123` (seed). Cambiarlas desde **Usuarios** tras el primer ingreso.

---

## 12. Tests y verificación realizada

- **Backend:** `pytest` → 24 tests (auth/refresh/RBAC, CRUD de todos los recursos, cascada de
  dependencias, propagación de renombrados, francos/ausencias, roundtrip Excel, historial,
  seed idempotente, regresión de IDs de historial en edits multi-campo).
- **API end-to-end contra el servidor vivo:** 31 checks (login, snapshot con el dataset demo,
  CRUD completo + cascade, duplicado, propagación, permisos no-admin, export `.xlsx`,
  token inválido → 401).
- **Navegador (Playwright + Edge del sistema, `channel: "msedge"`):** login → tablero con los
  24 proyectos demo, búsqueda/filtros y modal de proyecto con Gantt renderizado; las capturas
  de `docs/screenshots/` se generan con ese dataset ficticio. El Chromium embebido de Playwright
  no se usa en este equipo porque el antivirus elimina su binario; el Edge instalado sirve de
  navegador de automatización sin descargas adicionales.
- **Build:** `next build` limpio (TypeScript estricto, 12 rutas estáticas).

---

## 13. Decisiones de diseño destacadas

- **Snapshot único + WebSocket** en lugar de queries por recurso: una sola cache coherente,
  invalidación trivial y tiempo real gratis entre pestañas/usuarios.
- **Reglas de negocio en el backend** (rollup, cascada, propagación): el cliente nunca calcula
  estado derivado que deba ser autoritativo — el frontend solo calcula presentación (francos, riesgo).
- **IDs legibles con prefijo** heredados del monolito: facilitan auditoría, Excel y referencias
  manuales (`depende_de` guarda el ID de la actividad).
- **`key_of` sin acentos** en todas las comparaciones: los datos industriales llegan con
  mayúsculas/acentos inconsistentes y el tablero no debe duplicar columnas por eso.
- **Preferencias en localStorage, datos en servidor**: el layout/tema/estilo de tabla son por
  navegador; WIP y anchos de Gantt también (paridad con el original).

---

## 14. Mejoras propuestas a los documentos base

Sobre `arch.md`:

1. **Migraciones reales con Alembic** desde el día uno (el template usa `create_all`); hoy queda
   reservado pero sin cadena de migraciones versionada.
2. **Refresh token rotation + blacklist** (el template guarda refresh sin revocación); permitir
   cerrar sesiones de otros dispositivos.
3. **Healthcheck con detalle** (`/api/health` hoy devuelve estado plano; sumar versión, DB y
   conteo de clientes WS facilitaría operación).
4. **Paginación/etags en snapshot** para bases grandes (hoy el snapshot completo es ideal para
   el volumen industrial actual, pero no escala a miles de proyectos).
5. **Documentar el contrato WebSocket** (topics, códigos de cierre) como parte del template.

Sobre `style.md`:

1. **Tokens de dominio explícitos** (estados Kanban, demanda, ausencias) además de los neutros:
   el preset default no cubre paletas semánticas de negocio.
2. **Especificación de impresión** (`@media print`, `no-print`) como parte del sistema: en
   planificación industrial imprimir el tablero/Gantt es un flujo real, no un extra.
3. **Guía de modales anidados** con la escala z (50/60) y foco/Escape, hoy implícita.
4. **Densidad de tablas como token** (los 4 estilos) en vez de clases ad-hoc por pantalla.
5. **Estados vacíos y de carga ilustrados** por tipo de vista (tablero, Gantt, listas).

---

## 15. Limitaciones conocidas y roadmap

- Sin papelera/undo de borrados: la eliminación pide confirmación y es definitiva (paridad con
  el original). Roadmap: soft-delete + restaurar.
- Sin edición colaborativa simultánea del mismo campo (last-write-wins con aviso por WS).
- Alembic sin migraciones iniciales versionadas (esquema creado por `create_all`).
- El import de Excel reemplaza toda la base (no hace merge incremental).
- Roadmap natural: adjuntos por proyecto, notificaciones por vencimiento, vista calendario,
  export PDF del Gantt, roles por área además de admin/usuario.

---

## 16. Paridad funcional con Kanban.html

| Función del monolito | Dónde vive ahora |
|---|---|
| Tablero Kanban con drag & drop por estado | `/tablero` + `PATCH /proyectos/{id}/estado` |
| KPIs (total, en progreso, completados, vencidos, avance medio) | `board/kpi-bar.tsx` |
| 10 filtros multi-select + AND/OR de etiquetas | `board/filters-bar.tsx`, `hooks/use-board-filters.ts` |
| Búsqueda global (proyecto + actividades) y rango de fechas | idem |
| Límites WIP por columna con alerta | `board/wip-modal.tsx` + localStorage |
| Modal de proyecto con modos Gantt/Checklist | `project/project-modal.tsx` |
| Gantt por proyecto: arrastre de barras, cascada, SVG dependencias, reorder, zoom/anchos | `project/gantt-panel.tsx` + `POST /actividades/{id}/move` |
| Hitos ◆ y fila de ausencias del equipo | `gantt-parts.tsx`, `gantt-panel.tsx`, `/gantt` |
| Comentarios por actividad y chat/notas/enlaces por proyecto | `project/comments-panel.tsx`, `notes-panel.tsx` |
| Checklist unificado con horas estimadas y demanda Alta/Media/Baja | `project/checklist-panel.tsx` |
| Historial de cambios con usuario y fecha | `project/history-panel.tsx`, `/historial` |
| Gantt global de todos los proyectos | `/gantt` |
| Dashboard con gráficos | `/dashboard` (recharts) |
| Gestor de etiquetas con propagación y colores | `/etiquetas` |
| Gestor de listas con propagación y reorder | `/listas` |
| Personal, ausencias y matemática de francos | `/personal` + `personal/ausencias-panel.tsx` |
| Modo oscuro, layout sidebar/top, estilos de tabla | `/configuracion` + hooks de preferencias |
| Impresión del tablero/Gantt | `@media print` + botones Imprimir |
| Import/export Excel con las mismas hojas | `/configuracion` + `app/utils/excel_*.py` |
| Persistencia en el Excel del negocio | Seed demo + export/import manual; la base viva es SQLite/Postgres |

La única diferencia deliberada: los datos ya no viven en un archivo Excel abierto por el
navegador sino en una base de datos servidor con concurrencia real, auditoría y tiempo real;
el Excel queda como formato de intercambio y respaldo.