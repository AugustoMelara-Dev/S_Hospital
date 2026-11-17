from collections.abc import Callable
from typing import Annotated

import pytest
from fastapi import APIRouter, Depends, FastAPI, Response
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import DB, require
from app.core.errors import BusinessRuleError
from app.core.idempotency import Idem
from app.models import AuditLog, IdempotencyKey, User

CALLS: dict[str, int] = {"n": 0}


class EchoIn(BaseModel):
    value: int


@pytest.fixture(autouse=True)
def idem_routes(app: FastAPI) -> None:
    CALLS["n"] = 0
    router = APIRouter(prefix="/api/_idem")

    @router.post("/echo", status_code=201)
    def echo(
        data: EchoIn,
        db: DB,
        user: Annotated[User, Depends(require("invoices.create"))],
        idem: Idem,
    ) -> Response:
        CALLS["n"] += 1
        if data.value < 0:
            raise BusinessRuleError("negative", "Valor negativo.")
        db.add(AuditLog(user_id=user.id, action="test.echo", result="success"))
        return idem.respond(201, {"value": data.value, "call": CALLS["n"]})

    @router.post("/pdf")
    def pdf(db: DB, user: Annotated[User, Depends(require("invoices.create"))], idem: Idem
            ) -> Response:
        CALLS["n"] += 1
        return idem.respond_bytes(
            b"%PDF-1.4 fake " + str(CALLS["n"]).encode(), "application/pdf",
            headers={"Content-Disposition": 'inline; filename="x.pdf"'},
        )

    app.include_router(router)


H = {"Idempotency-Key": "k-123"}


def test_missing_key_is_428(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    resp = client.post("/api/_idem/echo", json={"value": 1})
    assert resp.status_code == 428
    assert resp.json()["error"]["code"] == "idempotency_key_required"
    assert CALLS["n"] == 0


def test_key_too_long_is_422(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    resp = client.post("/api/_idem/echo", json={"value": 1}, headers={"Idempotency-Key": "x" * 101})
    assert resp.status_code == 422


def test_replay_same_body(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    first = client.post("/api/_idem/echo", json={"value": 7}, headers=H)
    assert first.status_code == 201
    assert "Idempotent-Replay" not in first.headers
    # Same JSON with different formatting/key order is the same request.
    second = client.post(
        "/api/_idem/echo", content=b'{ "value" : 7 }',
        headers={**H, "Content-Type": "application/json"},
    )
    assert second.status_code == 201
    assert second.headers["Idempotent-Replay"] == "true"
    assert second.json() == first.json() == {"value": 7, "call": 1}
    assert CALLS["n"] == 1
    assert db.scalar(select(func.count(AuditLog.id)).where(AuditLog.action == "test.echo")) == 1


def test_mismatch_is_409(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert client.post("/api/_idem/echo", json={"value": 1}, headers=H).status_code == 201
    resp = client.post("/api/_idem/echo", json={"value": 2}, headers=H)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "idempotency_key_mismatch"
    assert CALLS["n"] == 1


def test_errors_are_not_stored(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("cajero")
    resp = client.post("/api/_idem/echo", json={"value": -1}, headers=H)
    assert resp.status_code == 400
    assert db.scalar(select(func.count(IdempotencyKey.id))) == 0
    again = client.post("/api/_idem/echo", json={"value": -1}, headers=H)
    assert again.status_code == 400
    assert CALLS["n"] == 2


def test_keys_are_per_user(
    client: TestClient, login_as: Callable[..., User], make_client: Callable[[], TestClient]
) -> None:
    login_as("cajero")
    assert client.post("/api/_idem/echo", json={"value": 1}, headers=H).status_code == 201
    login_as("cajero")  # same client, now another user
    resp = client.post("/api/_idem/echo", json={"value": 1}, headers=H)
    assert resp.status_code == 201
    assert "Idempotent-Replay" not in resp.headers
    assert CALLS["n"] == 2


def test_in_progress_key_is_409(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    user = login_as("cajero")
    from app.core.idempotency import _fingerprint

    db.add(IdempotencyKey(
        user_id=user.id, route="POST /api/_idem/echo", key="k-123",
        fingerprint=_fingerprint("POST", "/api/_idem/echo", "", b'{"value": 1}'), status_code=0,
    ))
    db.commit()
    resp = client.post("/api/_idem/echo", json={"value": 1}, headers=H)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "idempotency_in_progress"


def test_binary_replay(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    first = client.post("/api/_idem/pdf", headers=H)
    second = client.post("/api/_idem/pdf", headers=H)
    assert first.status_code == second.status_code == 200
    assert second.headers["content-type"] == "application/pdf"
    assert second.headers["Idempotent-Replay"] == "true"
    assert second.headers["content-disposition"] == 'inline; filename="x.pdf"'
    assert second.content == first.content == b"%PDF-1.4 fake 1"


def test_permission_checked_before_idempotency(
    client: TestClient, login_as: Callable[..., User]
) -> None:
    login_as("auditor")
    resp = client.post("/api/_idem/echo", json={"value": 1}, headers=H)
    assert resp.status_code == 403
