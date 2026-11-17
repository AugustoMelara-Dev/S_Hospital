"""Facturas y pagos — STUB (to be implemented by the domain agent).

Endpoints this module will own (see docs/SPEC.md §6), all mounted under ``/api``::

    POST   /api/invoices/preview
    POST   /api/invoices                        [IDEM]
    GET    /api/invoices?search&status&date_from&date_to&cash_session_id&pending=1&page
    GET    /api/invoices/{id}
    POST   /api/invoices/{id}/payments          [IDEM]
    POST   /api/invoices/{id}/void              [IDEM]
    POST   /api/invoices/{id}/reverse           [IDEM]
    POST   /api/invoices/draft-receipt.pdf

Use ``app.core.deps.require``/``require_any`` for permissions, ``app.core.idempotency.Idem``
for [IDEM] endpoints, ``app.core.audit.audit`` for sensitive actions and put business
logic in ``app.services``.
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["invoices"])
