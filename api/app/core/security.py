"""Password hashing (argon2), password policy and opaque session tokens."""

from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

PASSWORD_POLICY_MESSAGE = (
    "La contraseña debe tener al menos 12 caracteres e incluir una minúscula, "
    "una mayúscula, un número y un símbolo."
)

_hasher = PasswordHasher()


def configure_hasher(**params: int) -> None:
    """Override argon2 parameters (tests use cheap ones for speed)."""
    global _hasher
    _hasher = PasswordHasher(**params)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def validate_password_policy(password: str) -> str | None:
    """Return a Spanish error message if the password violates the policy, else None."""
    ok = (
        len(password) >= 12
        and any(c.islower() for c in password)
        and any(c.isupper() for c in password)
        and any(c.isdigit() for c in password)
        and any(not c.isalnum() and not c.isspace() for c in password)
    )
    return None if ok else PASSWORD_POLICY_MESSAGE


# A pre-computed hash so failed logins for unknown users take similar time.
DUMMY_HASH = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash("dummy-password")


def new_session_token() -> str:
    """Opaque cookie value (never stored; only its SHA-256 is stored)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """64-char hex SHA-256 of a session token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
