"""Users administration: CRUD, password policy, self/last-admin protection, sessions."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import ALL_PERMISSIONS
from app.core.security import verify_password
from app.models import User
from tests.conftest import login
from tests.factories import get_role, make_role, make_user
from tests.factories_admin import REASON, audits, error_code, sessions_of

NEW_PASSWORD = "Nueva#Clave2026x"


def _reload(db: Session, user_id: int) -> User:
    db.expire_all()
    u = db.get(User, user_id)
    assert u is not None
    return u


def _payload(db: Session, **over: Any) -> dict[str, Any]:
    data: dict[str, Any] = {"name": "Ana  López", "username": "ALopez",
                            "email": "Ana@Hospital.hn", "password": NEW_PASSWORD,
                            "role_id": get_role(db, "cajero").id}
    data.update(over)
    return data


def test_list_users_shape_and_filters(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    make_user(db, "cajero", name="Zoila Cajera", username="zoila")
    make_user(db, "auditor", name="Inactivo", active=False)
    login_as("admin")
    body = client.get("/api/users").json()
    assert body["total"] == 3 and body["page"] == 1
    item = next(u for u in body["items"] if u["username"] == "zoila")
    assert set(item) == {"id", "name", "username", "email", "role", "active",
                         "must_change_password", "last_login_at"}
    assert item["role"]["code"] == "cajero" and "id" in item["role"]
    assert "password_hash" not in item
    assert client.get("/api/users?search=ZOILA").json()["total"] == 1
    assert client.get("/api/users?active=false").json()["total"] == 1
    role_id = get_role(db, "auditor").id
    assert client.get(f"/api/users?role_id={role_id}").json()["total"] == 1


def test_users_permissions(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("supervisor")
    assert client.get("/api/users").status_code == 403
    assert client.get("/api/roles").status_code == 403


def test_users_view_only_role(client: TestClient, db: Session,
                              login_as: Callable[..., User]) -> None:
    make_role(db, "rrhh", {"users.view"})
    login_as("rrhh")
    assert client.get("/api/users").status_code == 200
    assert client.get("/api/roles").status_code == 200
    assert client.post("/api/users", json=_payload(db)).status_code == 403


def test_create_user(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/users", json=_payload(db))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["username"] == "alopez"
    assert body["email"] == "ana@hospital.hn"
    assert body["name"] == "Ana López"
    assert body["must_change_password"] is True
    assert body["active"] is True
    rows = audits(db, "user.created")
    assert len(rows) == 1
    assert "password" not in str(rows[0].new_values).lower()
    # The new user can log in but must change the password first.
    other = TestClient(client.app, headers={"X-Requested-With": "shospital"})
    with other:
        assert login(other, "alopez", NEW_PASSWORD).status_code == 200
        blocked = other.get("/api/services")
        assert blocked.status_code == 403
        assert error_code(blocked) == "password_change_required"


def test_create_user_password_policy(client: TestClient, db: Session,
                                     login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/users", json=_payload(db, password="corta"))
    assert resp.status_code == 422
    assert "password" in resp.json()["error"]["fields"]
    resp = client.post("/api/users", json=_payload(db, password="sinsimbolosNiNada1"))
    assert resp.status_code == 422


def test_create_user_duplicates(client: TestClient, db: Session,
                                login_as: Callable[..., User]) -> None:
    make_user(db, "cajero", username="alopez", email="otra@hospital.hn")
    login_as("admin")
    resp = client.post("/api/users", json=_payload(db))
    assert resp.status_code == 409 and error_code(resp) == "username_taken"
    resp = client.post("/api/users", json=_payload(db, username="nuevo",
                                                   email="OTRA@hospital.hn"))
    assert resp.status_code == 409 and error_code(resp) == "email_taken"


def test_create_user_validations(client: TestClient, db: Session,
                                 login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert client.post("/api/users", json=_payload(db, username="a b")).status_code == 422
    assert client.post("/api/users", json=_payload(db, email="no-es-correo")).status_code == 422
    assert client.post("/api/users", json=_payload(db, role_id=9999)).status_code == 422


def test_cannot_grant_permissions_actor_lacks(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    make_role(db, "jefe_usuarios", {"users.view", "users.manage", "catalog.view"})
    login_as("jefe_usuarios")
    resp = client.post("/api/users", json=_payload(db, role_id=get_role(db, "admin").id))
    assert resp.status_code == 403
    assert error_code(resp) == "cannot_grant_permissions"


def test_update_user(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    target = make_user(db, "cajero")
    login_as("admin")
    resp = client.patch(f"/api/users/{target.id}", json={
        "name": "Nombre Nuevo", "role_id": get_role(db, "auditor").id, "email": ""})
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"]["code"] == "auditor"
    assert resp.json()["email"] is None
    assert len(audits(db, "user.role_changed")) == 1
    assert len(audits(db, "user.updated")) == 1


def test_cannot_change_own_role(client: TestClient, db: Session,
                                login_as: Callable[..., User]) -> None:
    me = login_as("admin")
    make_user(db, "admin")  # not the last admin
    resp = client.patch(f"/api/users/{me.id}", json={"role_id": get_role(db, "cajero").id})
    assert resp.status_code == 400
    assert error_code(resp) == "cannot_change_own_role"
    # Other self edits are allowed.
    assert client.patch(f"/api/users/{me.id}", json={"name": "Yo Mismo"}).status_code == 200


def test_admin_can_demote_other_admin_when_another_remains(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    other_admin = make_user(db, "admin")
    login_as("admin")  # the actor is a second active admin
    resp = client.post(f"/api/users/{other_admin.id}/toggle-active", json={"reason": REASON})
    assert resp.status_code == 200
    # An inactive admin does not count; changing its role is fine.
    resp = client.patch(f"/api/users/{other_admin.id}",
                        json={"role_id": get_role(db, "cajero").id})
    assert resp.status_code == 200


def test_last_active_admin_protected(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    target = make_user(db, "admin")  # the only user with the admin role
    make_role(db, "casi_admin", set(ALL_PERMISSIONS))
    login_as("casi_admin")
    resp = client.patch(f"/api/users/{target.id}", json={"role_id": get_role(db, "cajero").id})
    assert resp.status_code == 400
    assert error_code(resp) == "last_admin"
    resp = client.post(f"/api/users/{target.id}/toggle-active", json={"reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "last_admin"
    assert _reload(db, target.id).active is True
    assert _reload(db, target.id).role.code == "admin"


def test_cannot_deactivate_self(client: TestClient, db: Session,
                                login_as: Callable[..., User]) -> None:
    me = login_as("admin")
    resp = client.post(f"/api/users/{me.id}/toggle-active", json={"reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "cannot_deactivate_self"


def test_deactivate_requires_reason_and_closes_sessions(
    client: TestClient, db: Session, login_as: Callable[..., User],
    make_client: Callable[[], TestClient],
) -> None:
    target = make_user(db, "cajero")
    other = make_client()
    assert login(other, target.username).status_code == 200
    assert sessions_of(db, target.id) == 1
    login_as("admin")
    resp = client.post(f"/api/users/{target.id}/toggle-active", json={})
    assert resp.status_code == 422
    resp = client.post(f"/api/users/{target.id}/toggle-active", json={"reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["active"] is False
    assert sessions_of(db, target.id) == 0
    assert other.get("/api/auth/me").status_code == 401
    rows = audits(db, "user.deactivated")
    assert len(rows) == 1 and rows[0].reason == REASON
    # Reactivate without reason.
    resp = client.post(f"/api/users/{target.id}/toggle-active", json={})
    assert resp.status_code == 200 and resp.json()["active"] is True
    assert len(audits(db, "user.activated")) == 1


def test_reset_password(
    client: TestClient, db: Session, login_as: Callable[..., User],
    make_client: Callable[[], TestClient],
) -> None:
    target = make_user(db, "cajero")
    other = make_client()
    assert login(other, target.username).status_code == 200
    login_as("admin")
    resp = client.post(f"/api/users/{target.id}/reset-password",
                       json={"password": NEW_PASSWORD})
    assert resp.status_code == 422
    resp = client.post(f"/api/users/{target.id}/reset-password",
                       json={"password": "debil", "reason": REASON})
    assert resp.status_code == 422
    resp = client.post(f"/api/users/{target.id}/reset-password",
                       json={"password": NEW_PASSWORD, "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["must_change_password"] is True
    u = _reload(db, target.id)
    assert verify_password(u.password_hash, NEW_PASSWORD)
    assert sessions_of(db, target.id) == 0
    assert other.get("/api/auth/me").status_code == 401
    rows = audits(db, "user.password_reset")
    assert len(rows) == 1
    assert NEW_PASSWORD not in str(rows[0].new_values)


def test_user_404(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert client.get("/api/users/99999").status_code == 404
    assert client.patch("/api/users/99999", json={"name": "X"}).status_code == 404
