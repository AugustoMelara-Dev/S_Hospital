#!/usr/bin/env python3
"""Pre-installation audit: multiresolution icon assets.

Verifica que el repositorio entregue tres .ico multirresolucion para Windows:
  - s-hospital-app.ico
  - s-hospital-installer.ico
  - s-hospital-maintenance.ico

Cada uno debe incluir como minimo las 9 resoluciones que Windows usa para
Explorador, Escritorio, barra de tareas y UAC:
  16, 20, 24, 32, 40, 48, 64, 128, 256.

Falla ruidosamente (exit 1) si alguna condicion no se cumple.
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path


EXPECTED_SIZES = (16, 20, 24, 32, 40, 48, 64, 128, 256)
EXPECTED_ICONS = (
    "s-hospital-app.ico",
    "s-hospital-installer.ico",
    "s-hospital-maintenance.ico",
)


def parse_ico(path: Path) -> list[tuple[int, int]]:
    data = path.read_bytes()
    if len(data) < 6:
        raise ValueError(f"{path}: archivo demasiado pequeno para ser un .ico valido")

    reserved, type_, count = struct.unpack_from("<HHH", data, 0)
    if reserved != 0 or type_ != 1:
        raise ValueError(f"{path}: cabecera ICONDIR invalida (reserved={reserved}, type={type_})")
    if count <= 0:
        raise ValueError(f"{path}: el .ico no declara imagenes")

    sizes: list[tuple[int, int]] = []
    for index in range(count):
        offset = 6 + index * 16
        width = data[offset]
        height = data[offset + 1]
        if width == 0:
            width = 256
        if height == 0:
            height = 256
        sizes.append((width, height))
    return sizes


def audit(repo_root: Path) -> int:
    icons_dir = repo_root / "frontend" / "public" / "icons"
    errors: list[str] = []

    for filename in EXPECTED_ICONS:
        icon_path = icons_dir / filename
        if not icon_path.exists():
            errors.append(f"Falta el icono multirresolucion: {icon_path}")
            continue
        if icon_path.stat().st_size < 4096:
            errors.append(
                f"{icon_path} pesa {icon_path.stat().st_size} bytes; un .ico multirresolucion pesa multiples KB."
            )
        try:
            sizes = parse_ico(icon_path)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        present = set(sizes)
        for expected in EXPECTED_SIZES:
            if (expected, expected) not in present:
                errors.append(
                    f"{icon_path} no incluye la resolucion {expected}x{expected}. Presentes: {sorted(present)}"
                )

    main_app = icons_dir / "hospital-app.ico"
    if main_app.exists():
        errors.append(
            f"Aun existe el icono monorresolucion legado {main_app}; debe reemplazarse por s-hospital-app.ico multirresolucion."
        )

    if errors:
        print("Auditoria de iconos: FALLA", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print("Auditoria de iconos: OK")
    for filename in EXPECTED_ICONS:
        print(f"  {filename}: {len(parse_ico(icons_dir / filename))} resoluciones validas")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Raiz del repositorio S_Hospital.",
    )
    args = parser.parse_args()
    return audit(args.repo_root)


if __name__ == "__main__":
    raise SystemExit(main())
