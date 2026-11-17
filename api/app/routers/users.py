"""Usuarios y roles — STUB (to be implemented by the domain agent).

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    GET    /api/users | POST | PATCH /{id}
    POST   /api/users/{id}/toggle-active        {reason}
    POST   /api/users/{id}/reset-password       {password, reason}
    GET    /api/roles                           (con permission_catalog; ver app.core.permissions)
    POST   /api/roles | PATCH /api/roles/{id}

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["users"])
