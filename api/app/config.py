"""Application settings (environment variables with prefix ``SHS_``).

Relative paths (SQLite file, backup dir, web dist) resolve against the ``api/``
directory so commands behave the same regardless of the current directory.
Use :func:`get_settings` everywhere; tests call ``get_settings.cache_clear()``
after changing the environment.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent


def _resolve(path: str) -> Path:
    p = Path(path)
    return p if p.is_absolute() else (API_ROOT / p).resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SHS_", env_file=str(API_ROOT / ".env"), extra="ignore"
    )

    database_url: str = "sqlite:///./storage/dev.db"
    secret_key: str = "dev-insecure-secret-change-me"
    backup_key: str = ""
    backup_dir: str = "./storage/backups"
    cookie_secure: bool = False
    tz: str = "America/Tegucigalpa"
    daily_backup_time: str = "02:00"
    app_version: str = "2.0.0"
    web_dist: str = "../web/dist"

    session_hours: int = 12
    login_lock_minutes: int = 15
    login_max_failures_per_login: int = 5
    login_max_failures_per_ip: int = 20

    @property
    def resolved_database_url(self) -> str:
        """DATABASE_URL with relative SQLite paths anchored at ``api/``."""
        url = self.database_url
        prefix = "sqlite:///"
        if url.startswith(prefix) and not url.startswith("sqlite:////"):
            raw = url[len(prefix):]
            if raw and raw != ":memory:" and not Path(raw).is_absolute():
                path = _resolve(raw)
                path.parent.mkdir(parents=True, exist_ok=True)
                return f"{prefix}{path.as_posix()}"
        return url

    @property
    def backup_path(self) -> Path:
        return _resolve(self.backup_dir)

    @property
    def web_dist_path(self) -> Path:
        return _resolve(self.web_dist)


@lru_cache
def get_settings() -> Settings:
    return Settings()
