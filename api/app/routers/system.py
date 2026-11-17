"""Sistema: auditoría, respaldos y estado — STUB (to be implemented by the domain agent).

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    GET    /api/audit-logs?search&action&user_id&date_from&date_to&page   audit.view
    GET    /api/backups                         backups.view
    POST   /api/backups                         backups.create
    GET    /api/backups/{id}/download           backups.download
    GET    /api/system/status                   system.status

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["system"])
