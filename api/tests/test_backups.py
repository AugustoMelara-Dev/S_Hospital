"""Encrypted backups: create -> download -> decrypt roundtrip, retention, scheduler."""

from __future__ import annotations

import asyncio
import sqlite3
from collections.abc import Iterator
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AuditLog, Backup
from app.services import backups, scheduler
from app.services.backups import BackupError, restore_backup


@pytest.fixture
def backup_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    folder = tmp_path / "respaldos"
    monkeypatch.setenv("SHS_BACKUP_DIR", str(folder))
    monkeypatch.setenv("SHS_BACKUP_KEY", "clave-de-respaldo-de-prueba")
    get_settings.cache_clear()
    yield folder
    backups.wait_for_backups()
    monkeypatch.undo()
    get_settings.cache_clear()


def test_backup_roundtrip(db: Session, client: Any, login_as: Any, backup_dir: Path,
                          tmp_path: Path) -> None:
    login_as("admin")
    r = client.post("/api/backups")
    assert r.status_code == 202, r.text
    created = r.json()
    assert created["status"] == "pending" and created["kind"] == "manual"
    backups.wait_for_backups()

    listing = client.get("/api/backups").json()
    item = listing["items"][0]
    assert item["status"] == "success", item
    assert item["filename"].endswith(".db.gz.enc")
    assert listing["last_success"]["id"] == item["id"]
    assert len(item["sha256"]) == 64 and item["size_bytes"] > 0

    file_path = backup_dir / item["filename"]
    raw = file_path.read_bytes()
    assert raw.startswith(b"SHSBK1") and b"SQLite format 3" not in raw
    assert backups.sha256_file(file_path) == item["sha256"]

    dl = client.get(f"/api/backups/{item['id']}/download")
    assert dl.status_code == 200 and dl.content == raw
    downloaded = tmp_path / "descargado.db.gz.enc"
    downloaded.write_bytes(dl.content)

    restored = restore_backup(downloaded, "clave-de-respaldo-de-prueba", tmp_path / "out")
    assert restored.suffix == ".db"
    with sqlite3.connect(restored) as conn:
        assert conn.execute("SELECT count(*) FROM users").fetchone()[0] >= 1
        assert conn.execute("SELECT count(*) FROM services").fetchone()[0] > 0

    actions = set(db.scalars(select(AuditLog.action).where(AuditLog.action.like("backup.%"))))
    assert {"backup.requested", "backup.completed", "backup.downloaded"} <= actions


def test_wrong_key_and_tampering_are_rejected(db: Session, backup_dir: Path,
                                              tmp_path: Path) -> None:
    backup = backups.request_backup(db, None, "manual")
    done = backups.run_backup(backup.id)
    assert done is not None and done.status == "success"
    path = backup_dir / done.filename
    with pytest.raises(BackupError):
        restore_backup(path, "otra-clave", tmp_path / "x")
    tampered = tmp_path / "t.db.gz.enc"
    data = bytearray(path.read_bytes())
    data[60] ^= 0xFF
    tampered.write_bytes(bytes(data))
    with pytest.raises(BackupError):
        restore_backup(tampered, "clave-de-respaldo-de-prueba", tmp_path / "y")
    not_backup = tmp_path / "n.gz.enc"
    not_backup.write_bytes(b"hola mundo")
    with pytest.raises(BackupError):
        restore_backup(not_backup, "clave-de-respaldo-de-prueba", tmp_path / "z")
    assert not list((tmp_path / "x").glob("*.db"))


def test_failed_backup_is_recorded(db: Session, backup_dir: Path,
                                   monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(_url: Any, _dst: Path) -> str:
        raise BackupError("No se encontró mariadb-dump ni mysqldump en el PATH del servidor.")

    monkeypatch.setattr(backups, "dump_database", boom)
    backup = backups.request_backup(db, None, "manual")
    done = backups.run_backup(backup.id)
    assert done is not None and done.status == "failed"
    assert "mysqldump" in (done.error or "")
    assert not [p for p in backup_dir.iterdir() if p.name.startswith(".tmp")]


def test_concurrent_backup_conflict(db: Session, client: Any, login_as: Any,
                                    backup_dir: Path) -> None:
    db.add(Backup(filename="", status="pending", kind="manual"))
    db.commit()
    login_as("admin")
    r = client.post("/api/backups")
    assert r.status_code == 409 and r.json()["error"]["code"] == "backup_in_progress"


def test_backup_permissions(client: Any, login_as: Any, backup_dir: Path) -> None:
    login_as("cajero")
    assert client.get("/api/backups").status_code == 403
    assert client.post("/api/backups").status_code == 403
    login_as("auditor")
    assert client.get("/api/backups").status_code == 200
    assert client.post("/api/backups").status_code == 403
    assert client.get("/api/backups/1/download").status_code == 403
    login_as("admin")
    assert client.get("/api/backups/999/download").status_code == 404


def test_download_requires_success(db: Session, client: Any, login_as: Any,
                                   backup_dir: Path) -> None:
    b = Backup(filename="", status="failed", kind="manual", error="x")
    db.add(b)
    db.commit()
    login_as("admin")
    r = client.get(f"/api/backups/{b.id}/download")
    assert r.status_code == 400


def test_retention_keeps_last_14_scheduled(db: Session, backup_dir: Path) -> None:
    backup_dir.mkdir(parents=True, exist_ok=True)
    base = datetime(2026, 1, 1, tzinfo=UTC)
    for i in range(16):
        name = f"shospital-{i:02d}-scheduled.db.gz.enc"
        (backup_dir / name).write_bytes(b"x")
        db.add(Backup(filename=name, status="success", kind="scheduled",
                      created_at=base + timedelta(days=i)))
    db.add(Backup(filename="m.db.gz.enc", status="success", kind="manual", created_at=base))
    db.commit()
    assert backups.prune(db, "scheduled") == 2
    left = db.scalars(select(Backup.filename).where(Backup.kind == "scheduled")
                      .order_by(Backup.created_at)).all()
    assert len(left) == 14 and left[0] == "shospital-02-scheduled.db.gz.enc"
    assert not (backup_dir / "shospital-00-scheduled.db.gz.enc").exists()
    assert db.scalar(select(func.count(Backup.id)).where(Backup.kind == "manual")) == 1


def test_scheduled_backup_runs_once_per_day(db: Session, backup_dir: Path) -> None:
    first = backups.run_scheduled_backup()
    assert first is not None and first.status == "success" and first.kind == "scheduled"
    assert backups.run_scheduled_backup() is None
    assert db.scalar(select(func.count(Backup.id)).where(Backup.kind == "scheduled")) == 1


def test_next_run_after_honduras_time() -> None:
    at = time(2, 0)
    # 2026-11-17 07:00 UTC = 01:00 HN -> today 02:00 HN = 08:00 UTC
    assert scheduler.next_run_after(datetime(2026, 11, 17, 7, 0, tzinfo=UTC), at) == datetime(
        2026, 11, 17, 8, 0, tzinfo=UTC)
    # 2026-11-17 09:00 UTC = 03:00 HN -> tomorrow 08:00 UTC
    assert scheduler.next_run_after(datetime(2026, 11, 17, 9, 0, tzinfo=UTC), at) == datetime(
        2026, 11, 18, 8, 0, tzinfo=UTC)
    assert scheduler.parse_daily_time("off") is None
    assert scheduler.parse_daily_time("23:45") == time(23, 45)
    assert scheduler.parse_daily_time("abc") is None


def test_start_and_stop_scheduler(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    monkeypatch.setenv("SHS_DAILY_BACKUP_TIME", "02:00")
    get_settings.cache_clear()

    async def run() -> None:
        task = scheduler.start_scheduler(app)
        assert task is not None and not task.done()
        await scheduler.stop_scheduler(app)
        assert task.cancelled()
        monkeypatch.setenv("SHS_DAILY_BACKUP_TIME", "off")
        get_settings.cache_clear()
        assert scheduler.start_scheduler(app) is None

    try:
        asyncio.run(run())
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
        get_settings.cache_clear()
