"""Application errors rendered as the SPEC error envelope.

Raise any :class:`AppError` (or subclass) from services/routers/dependencies;
``app.main`` converts it to::

    {"error": {"code": "...", "message": "...", "fields": {...}}}
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class AppError(Exception):
    status: int = 400
    code: str = "business_rule"
    message: str = "No se pudo completar la operación."

    def __init__(
        self,
        code: str | None = None,
        message: str | None = None,
        status: int | None = None,
        fields: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        self.code = code or type(self).code
        self.message = message or type(self).message
        self.status = status or type(self).status
        self.fields: dict[str, str] = dict(fields or {})
        self.headers: dict[str, str] = dict(headers or {})
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        return {"error": {"code": self.code, "message": self.message, "fields": self.fields}}


class BusinessRuleError(AppError):
    status = 400
    code = "business_rule"


class UnauthorizedError(AppError):
    status = 401
    code = "unauthenticated"
    message = "Su sesión no es válida o expiró. Inicie sesión nuevamente."


class ForbiddenError(AppError):
    status = 403
    code = "forbidden"
    message = "No tiene permiso para realizar esta acción."


class NotFoundError(AppError):
    status = 404
    code = "not_found"
    message = "El recurso solicitado no existe."


class ConflictError(AppError):
    status = 409
    code = "conflict"
    message = "La operación entra en conflicto con el estado actual."


class ValidationFailedError(AppError):
    """Use for 422 errors detected in services: ``ValidationFailedError(fields={...})``."""

    status = 422
    code = "validation_error"
    message = "Revise los datos ingresados."


class LockedError(AppError):
    status = 423
    code = "login_locked"
    message = "Demasiados intentos. Espere 15 minutos."


class PreconditionRequiredError(AppError):
    status = 428
    code = "idempotency_key_required"
    message = "Falta el encabezado Idempotency-Key."


class TooManyRequestsError(AppError):
    status = 429
    code = "too_many_requests"
    message = "Demasiadas solicitudes. Intente de nuevo en un momento."
