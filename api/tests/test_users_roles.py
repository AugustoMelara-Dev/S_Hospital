"""Roles: listing with permission catalog, create, edit, protections."""

from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import ALL_PERMISSIONS
from app.models import User
from tests.factories import get_role, make_role, make_user
from tests.factories_admin import audits, error_code


def test_list_roles_with_catalog(client: TestClient, db: Session,
                                 login_as: Callable[..., User]) -> None:
    make_user(db, "cajero")
    login_as("admin")
    resp = client.get("/api/roles")
    assert resp.status_code == 200
    body = resp.json()
    roles = {r["code"]: r for r in body["items"]}
    assert set(roles) >= {"admin", "supervisor", "auditor", "soporte", "cajero"}
    assert roles["admin"]["editable"] is False
    assert roles["admin"]["is_system"] is True
    assert sorted(roles["admin"]["permissions"]) == sorted(ALL_PERMISSIONS)
    assert roles["cajero"]["users_count"] == 1
    assert body["total"] == len(body["items"])
    catalog = {m["module"]: m for m in body["permission_catalog"]}
    assert catalog["catalog"]["label"] == "Catálogo y precios"
    codes = {p["code"] for m in body["permission_catalog"] for p in m["permissions"]}
    assert codes == set(ALL_PERMISSIONS)
    assert all(p["label"] for m in body["permission_catalog"] for p in m["permissions"])


def test_create_role(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/roles", json={
        "code": "farmacia", "name": "Farmacia", "permissions": ["catalog.view",
                                                               "invoices.view"]})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["is_system"] is False and body["editable"] is True
    assert body["permissions"] == ["catalog.view", "invoices.view"]
    assert len(audits(db, "role.created")) == 1


def test_create_role_validation(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    bad = client.post("/api/roles", json={"code": "x1", "name": "X",
                                          "permissions": ["no.existe"]})
    assert bad.status_code == 422
    assert "permissions" in bad.json()["error"]["fields"]
    assert client.post("/api/roles", json={"code": "Con Espacios", "name": "X"}
                       ).status_code == 422
    dup = client.post("/api/roles", json={"code": "cajero", "name": "Otro"})
    assert dup.status_code == 409


def test_admin_role_not_editable(client: TestClient, db: Session,
                                 login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.patch(f"/api/roles/{get_role(db, 'admin').id}", json={"name": "Jefes"})
    assert resp.status_code == 400
    assert error_code(resp) == "role_not_editable"


def test_edit_system_role_permissions(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    cajero = get_role(db, "cajero")
    perms = sorted(cajero.permissions - {"patients.mark_dialysis_prescription"})
    resp = client.patch(f"/api/roles/{cajero.id}", json={"permissions": perms,
                                                        "reason": "Cambio de política"})
    assert resp.status_code == 200
    assert "patients.mark_dialysis_prescription" not in resp.json()["permissions"]
    rows = audits(db, "role.updated")
    assert len(rows) == 1
    assert rows[0].reason == "Cambio de política"


def test_permission_change_takes_effect_immediately(
    client: TestClient, db: Session, login_as: Callable[..., User],
    make_client: Callable[[], TestClient],
) -> None:
    from tests.conftest import login

    cashier = make_user(db, "cajero")
    other = make_client()
    assert login(other, cashier.username).status_code == 200
    assert other.get("/api/services").status_code == 200
    login_as("admin")
    cajero = get_role(db, "cajero")
    client.patch(f"/api/roles/{cajero.id}",
                 json={"permissions": sorted(cajero.permissions - {"catalog.view"})})
    assert other.get("/api/services").status_code == 403


def test_cannot_edit_own_role_permissions(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    make_role(db, "gestor", {"users.view", "users.manage", "catalog.view"})
    login_as("gestor")
    role = get_role(db, "gestor")
    resp = client.patch(f"/api/roles/{role.id}", json={"permissions": ["users.view"]})
    assert resp.status_code == 400
    assert error_code(resp) == "cannot_edit_own_role"
    # Renaming is allowed.
    assert client.patch(f"/api/roles/{role.id}", json={"name": "Gestión"}).status_code == 200


def test_cannot_escalate_via_roles(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    make_role(db, "gestor", {"users.view", "users.manage"})
    login_as("gestor")
    resp = client.post("/api/roles", json={"code": "nuevo", "name": "N",
                                           "permissions": ["settings.update"]})
    assert resp.status_code == 403
    assert error_code(resp) == "cannot_grant_permissions"
    cajero = get_role(db, "cajero")
    resp = client.patch(f"/api/roles/{cajero.id}",
                        json={"permissions": sorted(cajero.permissions | {"settings.view"})})
    assert resp.status_code == 403


def test_roles_manage_requires_permission(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    make_role(db, "lector", {"users.view"})
    login_as("lector")
    assert client.post("/api/roles", json={"code": "zz", "name": "Z"}).status_code == 403
    assert client.patch(f"/api/roles/{get_role(db, 'cajero').id}",
                        json={"name": "Z"}).status_code == 403


def test_role_404(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert client.patch("/api/roles/99999", json={"name": "Z"}).status_code == 404
