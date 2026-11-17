"""Caja: cajas físicas y sesiones (turnos) — STUB (to be implemented by the domain agent).

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    GET    /api/cash-registers
    GET    /api/cash-sessions/current           -> CashSession | null (con reconciliation)
    POST   /api/cash-sessions/open              [IDEM]
    POST   /api/cash-sessions/{id}/close        [IDEM]
    GET    /api/cash-sessions?status&user_id&cash_register_id&date_from&date_to&difference&page
    GET    /api/cash-sessions/{id}
    GET    /api/cash-sessions/{id}/summary.pdf

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["cash"])
