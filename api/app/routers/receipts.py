"""Recibos institucionales y ajustes de impresión — STUB (to be implemented by the domain agent).

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    GET    /api/receipts/{id}
    GET    /api/receipts/{id}/pdf?profile=code
    POST   /api/receipts/{id}/reprint           [IDEM] -> PDF
    POST   /api/invoices/{id}/receipt           [IDEM]
    GET    /api/receipt-settings                -> {series[], profiles[]}
    POST   /api/receipt-series | PATCH /api/receipt-series/{id}
    PATCH  /api/print-profiles/{id}
    POST   /api/print-profiles/{code}/test.pdf

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["receipts"])
