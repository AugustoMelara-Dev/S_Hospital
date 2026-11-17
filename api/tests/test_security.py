import pytest

from app.core.permissions import ALL_PERMISSIONS, SYSTEM_ROLES, permission_catalog
from app.core.security import (
    PASSWORD_POLICY_MESSAGE,
    hash_password,
    hash_token,
    new_session_token,
    validate_password_policy,
    verify_password,
)


@pytest.mark.parametrize(
    "password",
    ["corta#A1", "sinmayusculas#2026", "SINMINUSCULAS#2026", "SinNumeros#Clave", "SinSimbolo2026X"],
)
def test_password_policy_rejects(password: str) -> None:
    assert validate_password_policy(password) == PASSWORD_POLICY_MESSAGE


def test_password_policy_accepts() -> None:
    assert validate_password_policy("Hospital#2026") is None
    assert validate_password_policy("Clave-Segura-9x") is None


def test_hash_and_verify() -> None:
    h = hash_password("Hospital#2026")
    assert h != "Hospital#2026"
    assert verify_password(h, "Hospital#2026")
    assert not verify_password(h, "otra")
    assert not verify_password("no-es-un-hash", "x")
    assert not verify_password(None, "x")


def test_session_tokens() -> None:
    a, b = new_session_token(), new_session_token()
    assert a != b
    assert len(hash_token(a)) == 64


def test_system_roles_match_spec() -> None:
    assert set(SYSTEM_ROLES) == {"admin", "supervisor", "auditor", "soporte", "cajero"}
    assert SYSTEM_ROLES["admin"][1] == ALL_PERMISSIONS
    assert len(ALL_PERMISSIONS) == 32
    cajero = SYSTEM_ROLES["cajero"][1]
    assert "patients.mark_dialysis_prescription" in cajero
    assert "invoices.operate_any" not in cajero
    supervisor = SYSTEM_ROLES["supervisor"][1]
    assert {"invoices.reverse", "cash.close_any", "receipts.reprint_any"} <= supervisor
    assert "users.manage" not in supervisor
    assert SYSTEM_ROLES["soporte"][1] == {
        "system.status", "receipt_settings.view", "receipt_settings.update", "backups.view"
    }


def test_permission_catalog_covers_all() -> None:
    codes = {p["code"] for g in permission_catalog() for p in g["permissions"]}
    assert codes == ALL_PERMISSIONS
