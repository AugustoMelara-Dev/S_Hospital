"""Command line: ``python -m app.cli <command>`` (run from the ``api/`` folder).

    migrate                          alembic upgrade head
    seed [--demo]                    idempotent base data (+ demo data)
    create-admin --username U --name N [--email E]
                                     password from SHS_ADMIN_PASSWORD or prompt;
                                     the admin must change it at first login
    serve [--host 0.0.0.0] [--port 8000] [--reload]
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy import func, or_, select

from app.config import API_ROOT, get_settings


def cmd_migrate(_args: argparse.Namespace) -> int:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
    command.upgrade(cfg, "head")
    print("Migraciones aplicadas.")
    return 0


def cmd_seed(args: argparse.Namespace) -> int:
    from app.db import new_session
    from app.seed.seeder import seed

    with new_session() as db:
        result = seed(db, demo=args.demo)
    print("Datos base listos" + (" (demo)" if args.demo else "") + ":", result.as_dict())
    return 0


def cmd_create_admin(args: argparse.Namespace) -> int:
    from app.core.audit import audit
    from app.core.security import hash_password, validate_password_policy
    from app.db import new_session
    from app.models import Role, User

    password = os.environ.get("SHS_ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Contraseña: ")
        if password != getpass.getpass("Confirmar contraseña: "):
            print("Las contraseñas no coinciden.", file=sys.stderr)
            return 1
    error = validate_password_policy(password)
    if error:
        print(error, file=sys.stderr)
        return 1

    username = args.username.strip().lower()
    email = args.email.strip().lower() if args.email else None
    with new_session() as db:
        role = db.scalar(select(Role).where(Role.code == "admin"))
        if role is None:
            print("Ejecute primero: python -m app.cli seed", file=sys.stderr)
            return 1
        clash = db.scalar(
            select(User).where(
                or_(func.lower(User.username) == username,
                    func.lower(User.email) == (email or "\x00"))
            )
        )
        if clash is not None:
            print("Ya existe un usuario con ese nombre de usuario o correo.", file=sys.stderr)
            return 1
        user = User(name=args.name.strip(), username=username, email=email,
                    password_hash=hash_password(password), role_id=role.id, active=True,
                    must_change_password=True)
        db.add(user)
        db.flush()
        audit(db, None, "user.created", entity=user, reason="CLI create-admin",
              new={"username": username, "role": "admin"})
        db.commit()
    print(f"Usuario administrador '{username}' creado. Deberá cambiar la contraseña al ingresar.")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload,
                app_dir=str(API_ROOT), proxy_headers=False)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="S_Hospital v2 API")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("migrate", help="Aplicar migraciones (alembic upgrade head)").set_defaults(
        func=cmd_migrate)

    p_seed = sub.add_parser("seed", help="Sembrar datos base (idempotente)")
    p_seed.add_argument("--demo", action="store_true", help="Incluir datos y usuarios demo")
    p_seed.set_defaults(func=cmd_seed)

    p_admin = sub.add_parser("create-admin", help="Crear usuario administrador")
    p_admin.add_argument("--username", required=True)
    p_admin.add_argument("--name", required=True)
    p_admin.add_argument("--email")
    p_admin.set_defaults(func=cmd_create_admin)

    p_serve = sub.add_parser("serve", help="Iniciar servidor (uvicorn)")
    p_serve.add_argument("--host", default="0.0.0.0")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.add_argument("--reload", action="store_true")
    p_serve.set_defaults(func=cmd_serve)
    return parser


def main(argv: list[str] | None = None) -> int:
    get_settings()
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
