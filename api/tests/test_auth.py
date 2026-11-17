from collections.abc import Callable
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import now_utc
from app.models import AuditLog, LoginAttempt, User, UserSession
from tests.conftest import login
from tests.factories import DEFAULT_PASSWORD, make_user


def _audits(db: Session, action: str, result: str) -> int:
    return db.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.action == action, AuditLog.result == result)
    ) or 0


def test_login_success_sets_cookie_and_returns_me(client: TestClient, db: Session) -> None:
    user = make_user(db, "cajero", username="caja1", email="caja1@hospital.hn")
    resp = login(client, "caja1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "caja1"
    assert body["role"] == {"code": "cajero", "name": "Caja"}
    assert "invoices.create" in body["permissions"]
    assert body["must_change_password"] is False
    set_cookie = resp.headers["set-cookie"].lower()
    assert "shs_session=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=strict" in set_cookie
    db.refresh(user)
    assert user.last_login_at is not None
    assert _audits(db, "auth.login", "success") == 1


def test_login_by_email_case_insensitive(client: TestClient, db: Session) -> None:
    make_user(db, "auditor", email="auditoria@hospital.hn")
    assert login(client, "AUDITORIA@hospital.hn").status_code == 200


def test_login_wrong_password(client: TestClient, db: Session) -> None:
    make_user(db, "cajero", username="caja2")
    resp = login(client, "caja2", "Incorrecta#2026")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"
    assert resp.json()["error"]["message"] == "Usuario o contraseña incorrectos."
    assert _audits(db, "auth.login", "failed") == 1


def test_login_unknown_user(client: TestClient) -> None:
    resp = login(client, "nadie")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"


def test_lockout_after_five_failures(client: TestClient, db: Session) -> None:
    make_user(db, "cajero", username="caja3")
    for _ in range(5):
        assert login(client, "caja3", "Mala#Clave2026").status_code == 401
    resp = login(client, "caja3")  # correct password, but locked
    assert resp.status_code == 423
    assert resp.json()["error"]["code"] == "login_locked"
    assert resp.json()["error"]["message"] == "Demasiados intentos. Espere 15 minutos."
    # Other logins from the same IP are not affected (IP limit is 20).
    make_user(db, "cajero", username="caja4")
    assert login(client, "caja4").status_code == 200


def test_lockout_expires_after_window(client: TestClient, db: Session) -> None:
    make_user(db, "cajero", username="caja5")
    for _ in range(5):
        login(client, "caja5", "Mala#Clave2026")
    old = now_utc() - timedelta(minutes=16)
    for attempt in db.scalars(select(LoginAttempt).where(LoginAttempt.login == "caja5")):
        attempt.attempted_at = old
    db.commit()
    assert login(client, "caja5").status_code == 200


def test_ip_lockout_after_twenty_failures(client: TestClient, db: Session) -> None:
    for i in range(20):
        login(client, f"fantasma{i}", "Mala#Clave2026")
    make_user(db, "cajero", username="caja6")
    assert login(client, "caja6").status_code == 423


def test_inactive_user_cannot_login(client: TestClient, db: Session) -> None:
    make_user(db, "cajero", username="caja7", active=False)
    resp = login(client, "caja7")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "account_inactive"


def test_session_of_deactivated_user_is_rejected(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    user = login_as("cajero")
    assert client.get("/api/auth/me").status_code == 200
    user.active = False
    db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_me_requires_session(client: TestClient) -> None:
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthenticated"


def test_expired_session_is_rejected(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("cajero")
    sess = db.scalars(select(UserSession)).one()
    sess.expires_at = now_utc() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_session_expiry_slides(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("cajero")
    sess = db.scalars(select(UserSession)).one()
    sess.last_seen_at = now_utc() - timedelta(hours=1)
    sess.expires_at = now_utc() + timedelta(hours=1)
    db.commit()
    assert client.get("/api/auth/me").status_code == 200
    db.expire_all()
    sess = db.scalars(select(UserSession)).one()
    assert sess.expires_at > now_utc() + timedelta(hours=11)


def test_logout(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert db.scalar(select(func.count(UserSession.id))) == 0


def test_csrf_header_required_for_non_get(client: TestClient, db: Session) -> None:
    make_user(db, "cajero", username="caja8")
    resp = client.post(
        "/api/auth/login",
        json={"login": "caja8", "password": DEFAULT_PASSWORD},
        headers={"X-Requested-With": "otro"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "csrf"
    # GET requests don't need it.
    assert client.get("/api/health", headers={"X-Requested-With": ""}).status_code == 200


def test_must_change_password_gating(
    client: TestClient, db: Session, login_as: Callable[..., User], app_with_probe: None
) -> None:
    login_as("cajero", must_change_password=True)
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["must_change_password"] is True
    resp = client.get("/api/_probe/any-user")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "password_change_required"

    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "Nueva#Clave2026"},
    )
    assert resp.status_code == 200
    assert resp.json()["must_change_password"] is False
    assert client.get("/api/_probe/any-user").status_code == 200


def test_change_password_validations(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("cajero")
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "Equivocada#2026", "new_password": "Nueva#Clave2026"},
    )
    assert resp.status_code == 422
    assert "current_password" in resp.json()["error"]["fields"]

    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "debil"},
    )
    assert resp.status_code == 422
    assert "12 caracteres" in resp.json()["error"]["fields"]["new_password"]

    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": DEFAULT_PASSWORD},
    )
    assert resp.status_code == 422


def test_change_password_revokes_other_sessions(
    client: TestClient,
    db: Session,
    login_as: Callable[..., User],
    make_client: Callable[[], TestClient],
) -> None:
    user = login_as("cajero")
    other = make_client()
    assert login(other, user.username).status_code == 200
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": "Nueva#Clave2026"},
    )
    assert resp.status_code == 200
    assert client.get("/api/auth/me").status_code == 200
    assert other.get("/api/auth/me").status_code == 401
    assert login(client, user.username, "Nueva#Clave2026").status_code == 200
    assert _audits(db, "auth.password_changed", "success") == 1


def test_login_validation_error_envelope(client: TestClient) -> None:
    resp = client.post("/api/auth/login", json={"login": ""})
    assert resp.status_code == 422
    err = resp.json()["error"]
    assert err["code"] == "validation_error"
    assert err["fields"]["password"] == "Este campo es obligatorio."
    assert err["fields"]["login"] == "Debe tener al menos 1 caracteres."
