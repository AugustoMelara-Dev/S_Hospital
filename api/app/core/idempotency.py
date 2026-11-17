"""Idempotency for [IDEM] endpoints (SPEC §2).

Rules (per user + route + key):

- Missing ``Idempotency-Key`` header -> 428 ``idempotency_key_required``;
  longer than 100 chars -> 422 ``invalid_idempotency_key``.
- Same key + same body, stored 2xx response -> the stored response is replayed
  (same status/body/content-type) with header ``Idempotent-Replay: true``.
- Same key + different body -> 409 ``idempotency_key_mismatch``.
- Same key while the first request is still running -> 409 ``idempotency_in_progress``.
- Only 2xx responses are stored. If the handler raises (e.g. ``AppError``) the
  reservation is released, so the client may retry with the same key.

Router usage — declare the permission dependency BEFORE ``Idem`` (dependencies
resolve in declaration order, so permissions are checked first) and return
``idem.respond(...)`` (or ``idem.respond_bytes(...)`` for PDFs) as the LAST step.
``respond`` commits the session, so the business change and the stored response
are committed atomically (do not call ``db.commit()`` yourself). Use ``Annotated``
dependencies so no parameter needs a default value::

    from typing import Annotated
    from app.core.deps import DB, require
    from app.core.idempotency import Idem

    Cashier = Annotated[User, Depends(require("payments.create"))]

    @router.post("/invoices/{invoice_id}/payments", status_code=201)
    def pay(invoice_id: int, data: PaymentIn, db: DB, user: Cashier, idem: Idem) -> Response:
        result = billing.register_payment(db, user, invoice_id, data)   # no commit
        return idem.respond(201, PaymentResult.model_validate(result))

    @router.post("/receipts/{receipt_id}/reprint")
    def reprint(receipt_id: int, data: ReprintIn, db: DB, user: Reprinter, idem: Idem):
        pdf = receipts.reprint(db, user, receipt_id, data)
        return idem.respond_bytes(pdf, "application/pdf",
                                  headers={"Content-Disposition": 'inline; filename="r.pdf"'})

Raising an ``AppError`` inside the handler releases the key automatically.
Only ``Content-Disposition`` and ``Location`` headers are stored for replays.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator, Mapping
from datetime import timedelta
from typing import Annotated, Any

from fastapi import Depends, Request, Response
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import DB, CurrentUser
from app.core.errors import ConflictError, PreconditionRequiredError, ValidationFailedError
from app.core.timeutil import now_utc
from app.models.system import IdempotencyKey

IDEMPOTENCY_HEADER = "Idempotency-Key"
REPLAY_HEADER = "Idempotent-Replay"
MAX_KEY_LENGTH = 100
STALE_AFTER = timedelta(minutes=5)
_STORED_HEADERS = ("content-disposition", "location")


class IdempotentReplay(Exception):
    """Raised by the dependency to short-circuit with a stored response."""

    def __init__(self, response: Response) -> None:
        self.response = response
        super().__init__("idempotent replay")


def _fingerprint(method: str, path: str, query: str, body: bytes) -> str:
    try:
        canonical = json.dumps(json.loads(body), sort_keys=True, separators=(",", ":")).encode()
    except (ValueError, UnicodeDecodeError):
        canonical = body
    h = hashlib.sha256()
    for part in (method.encode(), path.encode(), query.encode(), canonical):
        h.update(part)
        h.update(b"\x00")
    return h.hexdigest()


def _replay(record: IdempotencyKey) -> Response:
    headers = dict(record.headers or {})
    headers[REPLAY_HEADER] = "true"
    return Response(
        content=record.body or b"",
        status_code=record.status_code,
        media_type=record.content_type,
        headers=headers,
    )


class Idempotency:
    """Handle injected into [IDEM] routes. Call :meth:`respond` / :meth:`respond_bytes`."""

    def __init__(self, db: Session, record_id: int) -> None:
        self.db = db
        self.record_id = record_id
        self.completed = False

    def respond(
        self,
        status_code: int,
        payload: Any,
        headers: Mapping[str, str] | None = None,
    ) -> Response:
        """Serialize ``payload`` (dict / pydantic model / list) as JSON, store and commit."""
        body = json.dumps(jsonable_encoder(payload), ensure_ascii=False).encode("utf-8")
        return self._finish(status_code, body, "application/json", headers)

    def respond_bytes(
        self,
        content: bytes,
        media_type: str,
        status_code: int = 200,
        headers: Mapping[str, str] | None = None,
    ) -> Response:
        """Binary variant (e.g. PDF). Stored and replayed byte-for-byte."""
        return self._finish(status_code, content, media_type, headers)

    def _finish(
        self, status_code: int, body: bytes, media_type: str, headers: Mapping[str, str] | None
    ) -> Response:
        headers = dict(headers or {})
        record = self.db.get(IdempotencyKey, self.record_id)
        if 200 <= status_code < 300 and record is not None:
            record.status_code = status_code
            record.content_type = media_type
            record.headers = {k: v for k, v in headers.items() if k.lower() in _STORED_HEADERS}
            record.body = body
        elif record is not None:
            self.db.delete(record)
        self.db.commit()
        self.completed = True
        return Response(content=body, status_code=status_code, media_type=media_type,
                        headers=headers)

    def release(self) -> None:
        """Drop the reservation (used automatically when the handler fails)."""
        self.db.rollback()
        self.db.execute(delete(IdempotencyKey).where(IdempotencyKey.id == self.record_id))
        self.db.commit()


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def idempotency(
    request: Request,
    db: DB,
    user: CurrentUser,
    body: bytes = Depends(_raw_body),
) -> Iterator[Idempotency]:
    key = (request.headers.get(IDEMPOTENCY_HEADER) or "").strip()
    if not key:
        raise PreconditionRequiredError()
    if len(key) > MAX_KEY_LENGTH:
        raise ValidationFailedError(
            "invalid_idempotency_key",
            "La clave Idempotency-Key admite como máximo 100 caracteres.",
        )
    route = f"{request.method} {request.url.path}"[:255]
    fingerprint = _fingerprint(request.method, request.url.path, request.url.query, body)

    existing = db.scalar(
        select(IdempotencyKey).where(
            IdempotencyKey.user_id == user.id,
            IdempotencyKey.route == route,
            IdempotencyKey.key == key,
        )
    )
    if existing is not None:
        if existing.fingerprint != fingerprint:
            raise ConflictError(
                "idempotency_key_mismatch",
                "La clave de idempotencia ya se usó con datos diferentes.",
            )
        if existing.status_code:
            raise IdempotentReplay(_replay(existing))
        if now_utc() - existing.created_at < STALE_AFTER:
            raise ConflictError(
                "idempotency_in_progress",
                "La solicitud anterior con esta clave aún se está procesando.",
            )
        db.delete(existing)  # stale reservation (crashed request): take over
        db.flush()

    record = IdempotencyKey(
        user_id=user.id, route=route, key=key, fingerprint=fingerprint, status_code=0
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "idempotency_in_progress",
            "La solicitud anterior con esta clave aún se está procesando.",
        ) from exc

    idem = Idempotency(db, record.id)
    try:
        yield idem
    except BaseException:
        idem.release()
        raise
    if not idem.completed:
        idem.release()


Idem = Annotated[Idempotency, Depends(idempotency)]
