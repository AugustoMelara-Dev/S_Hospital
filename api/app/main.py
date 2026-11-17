"""FastAPI application factory.

- All routers in ``app.routers.ALL_ROUTERS`` are mounted under ``/api``.
- Errors always use the SPEC envelope ``{"error": {code, message, fields}}``
  (``AppError``, FastAPI 422 validation errors, 404/405 and unexpected 500s).
- CSRF: every non-GET/HEAD/OPTIONS request to ``/api`` must carry
  ``X-Requested-With: shospital`` or it gets 403 ``csrf``.
- If ``SHS_WEB_DIST`` exists, the SPA is served for non-``/api`` GET paths
  (static file if present, otherwise ``index.html``).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.core.errors import AppError
from app.core.idempotency import IdempotentReplay
from app.db import get_engine
from app.routers import ALL_ROUTERS

log = logging.getLogger("shospital")

CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "shospital"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def error_response(
    status: int, code: str, message: str, fields: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "fields": fields or {}}},
        headers=headers,
    )


# --- 422 translation -------------------------------------------------------

def _validation_message(err: dict[str, Any]) -> str:
    etype: str = err.get("type", "")
    ctx: dict[str, Any] = err.get("ctx") or {}
    messages: dict[str, str] = {
        "missing": "Este campo es obligatorio.",
        "extra_forbidden": "Campo no permitido.",
        "string_type": "Debe ser texto.",
        "string_too_short": "Debe tener al menos {min_length} caracteres.",
        "string_too_long": "Debe tener como máximo {max_length} caracteres.",
        "string_pattern_mismatch": "El formato no es válido.",
        "int_type": "Debe ser un número entero.",
        "int_parsing": "Debe ser un número entero.",
        "int_from_float": "Debe ser un número entero.",
        "float_parsing": "Debe ser un número.",
        "bool_parsing": "Debe ser verdadero o falso.",
        "bool_type": "Debe ser verdadero o falso.",
        "greater_than": "Debe ser mayor que {gt}.",
        "greater_than_equal": "Debe ser mayor o igual que {ge}.",
        "less_than": "Debe ser menor que {lt}.",
        "less_than_equal": "Debe ser menor o igual que {le}.",
        "too_short": "Debe tener al menos {min_length} elementos.",
        "too_long": "Debe tener como máximo {max_length} elementos.",
        "list_type": "Debe ser una lista.",
        "dict_type": "Debe ser un objeto.",
        "model_attributes_type": "Debe ser un objeto.",
        "enum": "Valor no permitido.",
        "literal_error": "Valor no permitido.",
        "date_parsing": "Fecha inválida (use AAAA-MM-DD).",
        "date_from_datetime_parsing": "Fecha inválida (use AAAA-MM-DD).",
        "datetime_parsing": "Fecha y hora inválidas.",
        "datetime_from_date_parsing": "Fecha y hora inválidas.",
        "json_invalid": "El cuerpo de la solicitud no es JSON válido.",
        "value_error": "{error}",
        "assertion_error": "{error}",
    }
    template = messages.get(etype)
    if template is None:
        return "Valor inválido."
    try:
        text = template.format(**ctx)
    except (KeyError, IndexError):
        text = "Valor inválido."
    if etype in ("value_error", "assertion_error"):
        text = str(ctx.get("error", "")) or "Valor inválido."
    return text


def _field_name(loc: tuple[Any, ...] | list[Any]) -> str:
    parts = [str(p) for p in loc]
    if parts and parts[0] in ("body", "query", "path", "header", "cookie", "form"):
        parts = parts[1:]
    return ".".join(parts) or "body"


def validation_fields(errors: list[dict[str, Any]]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for err in errors:
        name = _field_name(err.get("loc", ()))
        fields.setdefault(name, _validation_message(err))
    return fields


# --- SPA -------------------------------------------------------------------

def _spa_response(path: str) -> Response | None:
    dist: Path = get_settings().web_dist_path
    index = dist / "index.html"
    if not index.is_file():
        return None
    rel = path.lstrip("/")
    if rel:
        candidate = (dist / rel).resolve()
        if candidate.is_file() and candidate.is_relative_to(dist.resolve()):
            return FileResponse(candidate)
    return FileResponse(index, headers={"Cache-Control": "no-cache"})


# --- factory -----------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.services.scheduler import start_scheduler, stop_scheduler

    get_engine()  # fail fast on bad DATABASE_URL
    start_scheduler(app)  # daily backup (SHS_DAILY_BACKUP_TIME=off disables it)
    try:
        yield
    finally:
        await stop_scheduler(app)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="S_Hospital API",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    @app.middleware("http")
    async def csrf_guard(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        path = request.url.path
        if (
            (path == "/api" or path.startswith("/api/"))
            and request.method not in SAFE_METHODS
            and request.headers.get(CSRF_HEADER) != CSRF_VALUE
        ):
            return error_response(
                403, "csrf", "Solicitud rechazada por seguridad. Recargue la página."
            )
        return await call_next(request)

    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.status, exc.code, exc.message, exc.fields, exc.headers or None)

    @app.exception_handler(IdempotentReplay)
    async def _replay(_request: Request, exc: IdempotentReplay) -> Response:
        return exc.response

    @app.exception_handler(RequestValidationError)
    async def _validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(
            422, "validation_error", "Revise los datos ingresados.",
            validation_fields(list(exc.errors())),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> Response:
        path = request.url.path
        is_api = path == "/api" or path.startswith("/api/")
        if exc.status_code == 404 and not is_api and request.method in ("GET", "HEAD"):
            spa = _spa_response(path)
            if spa is not None:
                return spa
        mapping = {
            404: ("not_found", "Recurso no encontrado."),
            405: ("method_not_allowed", "Método no permitido."),
            401: ("unauthenticated", "Debe iniciar sesión."),
            403: ("forbidden", "No tiene permiso para realizar esta acción."),
        }
        code, message = mapping.get(
            exc.status_code, ("http_error", str(exc.detail) or "Error en la solicitud.")
        )
        return error_response(exc.status_code, code, message,
                              headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def _unexpected(_request: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error", exc_info=exc)
        return error_response(500, "internal_error",
                              "Ocurrió un error interno. Intente de nuevo o contacte a soporte.")

    for router in ALL_ROUTERS:
        app.include_router(router, prefix="/api")

    return app


app = create_app()
