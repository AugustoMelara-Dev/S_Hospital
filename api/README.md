# S_Hospital v2 — API (FastAPI)

Backend de caja hospitalaria offline. Contrato: `../docs/SPEC.md`.

## Entorno de desarrollo (Windows, desde `api/`)

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
```

Configuración por variables `SHS_*` (o archivo `api/.env`):

| Variable | Por defecto |
|---|---|
| `SHS_DATABASE_URL` | `sqlite:///./storage/dev.db` (prod: `mysql+pymysql://user:pass@127.0.0.1/shospital?charset=utf8mb4`) |
| `SHS_SECRET_KEY` | valor de desarrollo — **cambiar en producción** |
| `SHS_BACKUP_KEY`, `SHS_BACKUP_DIR` | `""`, `./storage/backups` |
| `SHS_COOKIE_SECURE` | `false` (LAN por HTTP) |
| `SHS_TZ` | `America/Tegucigalpa` |
| `SHS_DAILY_BACKUP_TIME` | `02:00` |
| `SHS_WEB_DIST` | `../web/dist` (SPA servido en `/` si existe) |

Las rutas relativas se resuelven contra la carpeta `api/`.

## Comandos

```powershell
.venv\Scripts\python -m app.cli migrate          # alembic upgrade head
.venv\Scripts\python -m app.cli seed             # datos base (idempotente)
.venv\Scripts\python -m app.cli seed --demo      # + institución, CAI y usuarios demo
.venv\Scripts\python -m app.cli create-admin --username jefe --name "Jefe TI"   # clave: SHS_ADMIN_PASSWORD o prompt
.venv\Scripts\python -m app.cli serve            # uvicorn 0.0.0.0:8000 (--reload para desarrollo)

.venv\Scripts\python -m pytest                   # pruebas (SQLite temporal por prueba)
.venv\Scripts\ruff check .                       # lint
```

Usuarios demo (`seed --demo`): `admin`, `supervisor`, `cajero`, `auditor` — clave `Hospital#2026`.
Documentación interactiva: `http://localhost:8000/api/docs`.

Nueva migración tras cambiar modelos:
`.venv\Scripts\alembic revision --autogenerate -m "describe el cambio"` (revisar el archivo generado;
debe funcionar en SQLite y MariaDB).

## Estructura

```
app/
  main.py          create_app(): routers bajo /api, sobre de errores, CSRF, SPA
  config.py        Settings (SHS_*), get_settings()
  db.py            Base, engine, get_db, init_engine, tipos BigId/LongBlob/UTCDateTime
  models/          todas las tablas del SPEC §4 (dinero = BIGINT centavos)
  core/
    errors.py      AppError + BusinessRuleError(400) Unauthorized(401) Forbidden(403)
                   NotFound(404) Conflict(409) ValidationFailed(422) Locked(423) ...
    deps.py        DB, CurrentUser, require(*perms), require_any(*perms)
    idempotency.py Idem (dependencia) + idem.respond()/respond_bytes()
    audit.py       audit(db, user, action, entity, result, reason, old, new, request)
    access.py      can_operate_invoice, can_view_any_invoices, ensure_can_operate_invoice
    money.py       parse_money, format_money, amount_in_words
    timeutil.py    now_utc, to_hn, iso_hn, hn_today, hn_day_bounds, hn_range_bounds
    permissions.py catálogo de permisos y roles del sistema
    pagination.py  PageParams + paginate()
    text.py        slugify, search_key (sin acentos), collapse_spaces
  routers/         un módulo por dominio (auth y public implementados; resto stubs)
  schemas/         InputSchema / OutputSchema / HNDateTime / Page / Reason
  services/        lógica de negocio (auth.py; los demás dominios agregan los suyos)
  seed/            catalogo_servicios.csv + seeder.py
migrations/        Alembic (una migración inicial)
tests/             conftest.py (fixtures) + factories.py
```

## Convenciones para extender

- Un router por dominio en `app/routers/<dominio>.py` (ya registrado en `main.py`);
  lógica en `app/services/<dominio>.py`; esquemas en `app/schemas/<dominio>.py`.
- Permisos: `user: Annotated[User, Depends(require("catalog.manage"))]`.
- Errores: `raise BusinessRuleError("codigo", "Mensaje en español.")`; 422 de servicio:
  `ValidationFailedError(fields={"campo": "mensaje"})`.
- [IDEM]: declarar `idem: Idem` después de la dependencia de permisos y terminar con
  `return idem.respond(201, payload)` (hace commit). Ver docstring de `app/core/idempotency.py`.
- Auditoría: `audit(db, user, "invoice.issued", entity=invoice, new={...}, request=request)`
  dentro de la misma transacción.
- Fechas de respuesta: usar `HNDateTime` en esquemas de salida (ISO con `-06:00`).
- Pruebas: fixtures `client`, `db`, `login_as("cajero")`, `make_client()`; helpers en
  `tests/factories.py` (`make_user`, `make_role`, `make_fiscal_sequence`, `open_cash_session`,
  `make_service`, `get_service`, `update_settings`).
