"""Catálogo: categorías, áreas y servicios — STUB (to be implemented by the domain agent).

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    GET    /api/categories | POST | PATCH /{id}        catalog.view / catalog.manage
    GET    /api/areas | POST | PATCH /{id}             catalog.view / catalog.manage
    GET    /api/services?search&category_id&area_id&active&billing=1&page&per_page
    GET    /api/services/{id}
    POST   /api/services
    PATCH  /api/services/{id}                          (motivos)
    GET    /api/services/{id}/history
    PATCH  /api/services/bulk-tax
    GET    /api/services/export.csv | export.xlsx
    POST   /api/services/import?mode=preview|apply

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["catalog"])
