"""Ajustes institucionales, numeración fiscal e impuestos — STUB.

To be implemented by the domain agent.

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    GET    /api/settings                      settings.view
    PUT    /api/settings                      settings.update (motivo si cambia RTN)
    POST   /api/settings/logo   (multipart)   settings.update
    DELETE /api/settings/logo                 settings.update
    GET    /api/fiscal-sequences              settings.view
    POST   /api/fiscal-sequences              settings.update
    PATCH  /api/fiscal-sequences/{id}         settings.update (motivo)
    GET    /api/tax-rates                     settings.view
    POST   /api/tax-rates                     settings.update
    PATCH  /api/tax-rates/{id}                settings.update (motivo)
    DELETE /api/tax-rates/{id}                settings.update (no borrar si está en uso)

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["settings"])
