"""Encrypted database backups (manual and scheduled) and offline restore helper.

Pipeline: dump (MariaDB/MySQL: ``mariadb-dump``/``mysqldump`` from PATH; SQLite: the
``sqlite3`` online backup API) -> gzip -> AES-256-GCM -> ``SHS_BACKUP_DIR``.
The key is derived (PBKDF2-HMAC-SHA256, random salt per file) from ``SHS_BACKUP_KEY``
or, if empty, ``SHS_SECRET_KEY`` — keep that value safe: without it a backup cannot
be restored.

File format (``*.gz.enc``)::

    b"SHSBK1" | len(ext):1 | ext (b"sql"|b"db") | salt:16 | nonce:12 | ciphertext | tag:16

The header is authenticated as AAD. Retention: last 30 manual / 14 scheduled
successful backups (older files and rows are removed and audited).

Restore is never automatic. From ``api/``::

    .venv\\Scripts\\python -m app.services.backups restore <file.gz.enc> [--out DIR]

writes the decrypted ``.sql`` / ``.db`` next to the backup (or in ``--out``); load it
manually (``mariadb shospital < file.sql``) during a maintenance window.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import logging
import os
import shutil
import sqlite3
import subprocess
import threading
from datetime import timedelta
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.audit import audit
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.core.timeutil import hn_day_bounds, hn_today, now_utc, to_hn
from app.db import get_engine, new_session
from app.models import Backup, User

log = logging.getLogger("shospital.backups")

MAGIC = b"SHSBK1"
SALT_LEN = 16
NONCE_LEN = 12
TAG_LEN = 16
KDF_ITERATIONS = 200_000
CHUNK = 1024 * 1024
RETENTION = {"manual": 30, "scheduled": 14}
STALE_PENDING = timedelta(hours=2)
DUMP_TIMEOUT_S = 3600


class BackupError(Exception):
    """Failure while producing a backup (message in Spanish, stored in ``backups.error``)."""


# --- crypto ---------------------------------------------------------------------------

def key_material(explicit: str | None = None) -> str:
    if explicit:
        return explicit
    settings = get_settings()
    return settings.backup_key or settings.secret_key


def derive_key(material: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt,
                     iterations=KDF_ITERATIONS)
    return kdf.derive(material.encode("utf-8"))


def encrypt_file(src: Path, dst: Path, material: str, ext: str) -> None:
    ext_b = ext.encode("ascii")
    salt, nonce = os.urandom(SALT_LEN), os.urandom(NONCE_LEN)
    header = MAGIC + bytes([len(ext_b)]) + ext_b + salt + nonce
    enc = Cipher(algorithms.AES(derive_key(material, salt)), modes.GCM(nonce)).encryptor()
    enc.authenticate_additional_data(header)
    with src.open("rb") as fin, dst.open("wb") as fout:
        fout.write(header)
        while chunk := fin.read(CHUNK):
            fout.write(enc.update(chunk))
        fout.write(enc.finalize())
        fout.write(enc.tag)


def decrypt_file(src: Path, dst: Path, material: str) -> str:
    """Decrypt ``src`` into ``dst`` (still gzip-compressed). Returns the inner extension.
    Raises ``BackupError`` on a wrong key or a corrupted/tampered file."""
    size = src.stat().st_size
    with src.open("rb") as fin:
        if fin.read(len(MAGIC)) != MAGIC:
            raise BackupError("El archivo no es un respaldo de S_Hospital.")
        ext_len = fin.read(1)[0]
        ext_b = fin.read(ext_len)
        salt, nonce = fin.read(SALT_LEN), fin.read(NONCE_LEN)
        header = MAGIC + bytes([ext_len]) + ext_b + salt + nonce
        body_len = size - len(header) - TAG_LEN
        if body_len < 0:
            raise BackupError("El respaldo está incompleto.")
        fin.seek(size - TAG_LEN)
        tag = fin.read(TAG_LEN)
        fin.seek(len(header))
        dec = Cipher(algorithms.AES(derive_key(material, salt)), modes.GCM(nonce, tag)).decryptor()
        dec.authenticate_additional_data(header)
        remaining = body_len
        with dst.open("wb") as fout:
            while remaining > 0:
                chunk = fin.read(min(CHUNK, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                fout.write(dec.update(chunk))
            try:
                fout.write(dec.finalize())
            except Exception as exc:  # InvalidTag
                fout.close()
                dst.unlink(missing_ok=True)
                raise BackupError(
                    "No se pudo descifrar el respaldo (clave incorrecta o archivo dañado)."
                ) from exc
    return ext_b.decode("ascii")


def restore_backup(path: str | Path, key: str | None = None,
                   out_dir: str | Path | None = None) -> Path:
    """Decrypt + decompress a backup into a ``.sql``/``.db`` file. Never touches the
    live database. Returns the written path."""
    src = Path(path)
    target_dir = Path(out_dir) if out_dir else src.parent
    target_dir.mkdir(parents=True, exist_ok=True)
    tmp_gz = target_dir / (src.name + ".tmp.gz")
    try:
        ext = decrypt_file(src, tmp_gz, key_material(key))
        stem = src.name.removesuffix(".gz.enc")
        stem = stem.removesuffix(f".{ext}")
        out = target_dir / f"{stem}.restored.{ext}"
        with gzip.open(tmp_gz, "rb") as fin, out.open("wb") as fout:
            shutil.copyfileobj(fin, fout, CHUNK)
        return out
    finally:
        tmp_gz.unlink(missing_ok=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(CHUNK):
            h.update(chunk)
    return h.hexdigest()


# --- dump ------------------------------------------------------------------------------

def dump_tool() -> str | None:
    return shutil.which("mariadb-dump") or shutil.which("mysqldump")


def dump_database(url: URL, dst: Path) -> str:
    """Write a plain dump of the database to ``dst``; returns the extension."""
    backend = url.get_backend_name()
    if backend == "sqlite":
        database = url.database or ""
        if not database or database == ":memory:":
            raise BackupError("La base SQLite en memoria no se puede respaldar.")
        src = sqlite3.connect(database)
        try:
            out = sqlite3.connect(str(dst))
            try:
                src.backup(out)
            finally:
                out.close()
        finally:
            src.close()
        return "db"
    if backend in ("mysql", "mariadb"):
        tool = dump_tool()
        if tool is None:
            raise BackupError(
                "No se encontró mariadb-dump ni mysqldump en el PATH del servidor."
            )
        cmd = [
            tool, f"--host={url.host or '127.0.0.1'}", f"--port={url.port or 3306}",
            f"--user={url.username or ''}", "--single-transaction", "--quick",
            "--routines", "--triggers", "--default-character-set=utf8mb4", "--hex-blob",
            str(url.database or ""),
        ]
        env = dict(os.environ)
        if url.password:
            env["MYSQL_PWD"] = str(url.password)
        with dst.open("wb") as out:
            proc = subprocess.run(
                cmd, stdout=out, stderr=subprocess.PIPE, env=env, timeout=DUMP_TIMEOUT_S,
                check=False,
            )
        if proc.returncode != 0:
            detail = proc.stderr.decode("utf-8", "replace").strip()[:500]
            raise BackupError(f"El volcado de la base de datos falló: {detail}")
        return "sql"
    raise BackupError(f"Motor de base de datos no soportado para respaldos: {backend}.")


# --- orchestration -----------------------------------------------------------------------

def backup_dir() -> Path:
    path = get_settings().backup_path
    path.mkdir(parents=True, exist_ok=True)
    return path


def request_backup(db: Session, user: User | None, kind: str = "manual",
                   request: Request | None = None) -> Backup:
    """Create the ``pending`` row (commits). Run it with :func:`start_backup_thread`."""
    cutoff = now_utc() - STALE_PENDING
    running = db.scalar(select(Backup).where(Backup.status == "pending",
                                             Backup.created_at >= cutoff))
    if running is not None:
        raise ConflictError("backup_in_progress", "Ya hay un respaldo en curso.")
    backup = Backup(filename="", status="pending", kind=kind,
                    created_by=user.id if user else None)
    db.add(backup)
    db.flush()
    audit(db, user, "backup.requested", entity=backup, new={"kind": kind}, request=request)
    db.commit()
    return backup


def run_backup(backup_id: int) -> Backup | None:
    """Produce the backup for an existing ``pending`` row (own DB session)."""
    db = new_session()
    try:
        backup = db.get(Backup, backup_id)
        if backup is None or backup.status != "pending":
            return backup
        folder = backup_dir()
        stamp = to_hn(backup.created_at or now_utc()).strftime("%Y%m%d-%H%M%S")
        tmp_plain = folder / f".tmp-{backup.id}.dump"
        tmp_gz = folder / f".tmp-{backup.id}.gz"
        try:
            ext = dump_database(get_engine().url, tmp_plain)
            with tmp_plain.open("rb") as fin, gzip.open(tmp_gz, "wb", compresslevel=6) as fout:
                shutil.copyfileobj(fin, fout, CHUNK)
            name = f"shospital-{stamp}-{backup.kind}-{backup.id}.{ext}.gz.enc"
            final = folder / name
            encrypt_file(tmp_gz, final, key_material(), ext)
            backup.filename = name
            backup.size_bytes = final.stat().st_size
            backup.sha256 = sha256_file(final)
            backup.status = "success"
            backup.completed_at = now_utc()
            audit(db, backup.created_by, "backup.completed", entity=backup,
                  new={"filename": name, "size_bytes": backup.size_bytes, "kind": backup.kind})
            db.commit()
            prune(db, backup.kind)
        except Exception as exc:
            log.exception("Backup %s failed", backup_id)
            db.rollback()
            backup = db.get(Backup, backup_id)
            if backup is not None:
                backup.status = "failed"
                backup.error = str(exc)[:2000] if isinstance(exc, BackupError) else (
                    f"Error inesperado: {type(exc).__name__}: {exc}"[:2000])
                backup.completed_at = now_utc()
                audit(db, backup.created_by, "backup.failed", entity=backup, result="failed",
                      reason=backup.error[:500])
                db.commit()
        finally:
            tmp_plain.unlink(missing_ok=True)
            tmp_gz.unlink(missing_ok=True)
        return backup
    finally:
        db.close()


def prune(db: Session, kind: str) -> int:
    keep = RETENTION.get(kind, 30)
    old = list(db.scalars(
        select(Backup).where(Backup.kind == kind, Backup.status == "success")
        .order_by(Backup.created_at.desc(), Backup.id.desc()).offset(keep)))
    folder = backup_dir()
    for b in old:
        path = folder / b.filename
        if b.filename and path.is_file():
            path.unlink()
        audit(db, None, "backup.pruned", entity=b, new={"filename": b.filename, "kind": kind})
        db.delete(b)
    if old:
        db.commit()
    return len(old)


_threads: dict[int, threading.Thread] = {}
_threads_lock = threading.Lock()


def start_backup_thread(backup_id: int) -> threading.Thread:
    thread = threading.Thread(target=run_backup, args=(backup_id,),
                              name=f"backup-{backup_id}", daemon=True)
    with _threads_lock:
        _threads[backup_id] = thread
    thread.start()
    return thread


def wait_for_backups(timeout: float = 60) -> None:
    """Join running backup threads (used by tests and graceful shutdown)."""
    with _threads_lock:
        threads = list(_threads.values())
        _threads.clear()
    for t in threads:
        t.join(timeout)


def run_scheduled_backup() -> Backup | None:
    """Daily job: skip if a scheduled backup already succeeded today (HN time)."""
    db = new_session()
    try:
        start, end = hn_day_bounds(hn_today())
        done = db.scalar(select(Backup).where(
            Backup.kind == "scheduled", Backup.status == "success",
            Backup.created_at >= start, Backup.created_at < end))
        if done is not None:
            return None
        try:
            backup = request_backup(db, None, "scheduled")
        except ConflictError:
            return None
        backup_id = backup.id
    finally:
        db.close()
    return run_backup(backup_id)


def get_backup_file(db: Session, backup_id: int) -> tuple[Backup, Path]:
    backup = db.get(Backup, backup_id)
    if backup is None:
        raise NotFoundError("backup_not_found", "El respaldo no existe.")
    if backup.status != "success" or not backup.filename:
        raise BusinessRuleError("backup_not_ready", "El respaldo no está disponible para descarga.")
    folder = backup_dir().resolve()
    path = (folder / backup.filename).resolve()
    if not path.is_relative_to(folder) or not path.is_file():
        raise NotFoundError("backup_file_missing", "El archivo del respaldo no se encuentra.")
    return backup, path


def last_success(db: Session) -> Backup | None:
    return db.scalar(select(Backup).where(Backup.status == "success")
                     .order_by(Backup.completed_at.desc(), Backup.id.desc()).limit(1))


def backup_payload(b: Backup | None, names: dict[int, str] | None = None) -> dict[str, Any] | None:
    if b is None:
        return None
    return {
        "id": b.id, "filename": b.filename, "size_bytes": b.size_bytes, "sha256": b.sha256,
        "status": b.status, "kind": b.kind, "error": b.error, "created_by": b.created_by,
        "created_by_name": (names or {}).get(b.created_by or 0),
        "created_at": b.created_at, "completed_at": b.completed_at,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.services.backups")
    sub = parser.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("restore", help="Descifra y descomprime un respaldo (no lo aplica)")
    r.add_argument("file")
    r.add_argument("--out", default=None)
    r.add_argument("--key", default=None, help="Clave (por defecto SHS_BACKUP_KEY/SECRET_KEY)")
    args = parser.parse_args(argv)
    out = restore_backup(args.file, args.key, args.out)
    print(f"Respaldo restaurado en: {out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
