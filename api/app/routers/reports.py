"""Reportes — STUB (to be implemented by the domain agent).

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    GET    /api/reports/today
    GET    /api/reports/summary?date_from&date_to&method&status&user_id&cash_session_id&category_id
    GET    /api/reports/summary.pdf
    GET    /api/reports/summary.xlsx            reports.export

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["reports"])
