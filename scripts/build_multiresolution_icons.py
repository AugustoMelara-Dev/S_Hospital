#!/usr/bin/env python3
"""Genera tres .ico multirresolucion para S_Hospital.

Salidas:
  - frontend/public/icons/s-hospital-app.ico        (cruz medica + recibo)
  - frontend/public/icons/s-hospital-installer.ico (flecha de instalacion)
  - frontend/public/icons/s-hospital-maintenance.ico (mantenimiento / escudo)

Las tres salen con 9 resoluciones: 16, 20, 24, 32, 40, 48, 64, 128, 256.

Si el archivo legado frontend/public/icons/hospital-app.ico existe, lo
retira para que el sistema deje de depender de el.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw


EXPECTED_SIZES = (16, 20, 24, 32, 40, 48, 64, 128, 256)

BG = (15, 23, 42, 255)
SURFACE = (248, 250, 252, 255)
CROSS = (15, 118, 110, 255)
INK = (100, 116, 139, 255)
INSTALL_ACCENT = (37, 99, 235, 255)
MAINTENANCE_ACCENT = (217, 119, 6, 255)


def _rounded_rectangle(draw: ImageDraw.ImageDraw, xy, radius, fill):
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def _cross(draw: ImageDraw.ImageDraw, cx: float, cy: float, arm: float, thickness: float, color):
    draw.rectangle((cx - thickness / 2, cy - arm, cx + thickness / 2, cy + arm), fill=color)
    draw.rectangle((cx - arm, cy - thickness / 2, cx + arm, cy + thickness / 2), fill=color)


def _receipt_lines(draw: ImageDraw.ImageDraw, top: float, left: float, right: float, color):
    draw.line((left, top, right, top), fill=color, width=max(2, int((right - left) * 0.02)))
    draw.line((left, top + 14, right - 30, top + 14), fill=color, width=max(2, int((right - left) * 0.02)))


def render_app_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = max(2, int(size * 0.18))
    _rounded_rectangle(draw, (0, 0, size - 1, size - 1), radius=radius, fill=BG)

    pad = max(2, int(size * 0.20))
    receipt_left = pad
    receipt_right = size - pad
    receipt_top = int(size * 0.20)
    receipt_bottom = int(size * 0.78)
    receipt_radius = max(2, int(size * 0.06))
    _rounded_rectangle(
        draw,
        (receipt_left, receipt_top, receipt_right, receipt_bottom),
        radius=receipt_radius,
        fill=SURFACE,
    )

    cx = size / 2
    cy = receipt_top + (receipt_bottom - receipt_top) * 0.36
    arm = size * 0.16
    thickness = size * 0.075
    _cross(draw, cx, cy, arm, thickness, CROSS)

    line_top = receipt_bottom - int(size * 0.10)
    _receipt_lines(
        draw,
        line_top,
        receipt_left + size * 0.06,
        receipt_right - size * 0.06,
        INK,
    )
    return image


def render_installer_icon(size: int) -> Image.Image:
    image = render_app_icon(size)
    draw = ImageDraw.Draw(image)

    arrow_color = INSTALL_ACCENT
    cx = size / 2
    top = size * 0.62
    bottom = size * 0.92
    shaft_width = max(2, int(size * 0.10))
    draw.rectangle(
        (cx - shaft_width / 2, top, cx + shaft_width / 2, bottom),
        fill=arrow_color,
    )
    head = size * 0.14
    draw.polygon(
        [
            (cx - head, bottom - head / 2),
            (cx + head, bottom - head / 2),
            (cx, bottom + head / 2),
        ],
        fill=arrow_color,
    )
    return image


def render_maintenance_icon(size: int) -> Image.Image:
    image = render_app_icon(size)
    draw = ImageDraw.Draw(image)

    accent = MAINTENANCE_ACCENT
    cx = size / 2
    cy = size * 0.74
    outer = size * 0.18
    inner = size * 0.10
    draw.ellipse((cx - outer, cy - outer, cx + outer, cy + outer), outline=accent, width=max(2, int(size * 0.04)))
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=accent)
    return image


def save_multiresolution_ico(target: Path, render) -> None:
    images = [render(size) for size in EXPECTED_SIZES]
    target.parent.mkdir(parents=True, exist_ok=True)

    png_payloads = [image_to_png(image) for image in images]
    directory = build_ico_directory(images, png_payloads)
    data = directory + b"".join(png_payloads)
    target.write_bytes(data)


def image_to_png(image: Image.Image) -> bytes:
    buffer = __import__("io").BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def build_ico_directory(images, png_payloads) -> bytes:
    import struct
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = bytearray()
    for image, payload in zip(images, png_payloads):
        width = image.width if image.width < 256 else 0
        height = image.height if image.height < 256 else 0
        entries += struct.pack(
            "<BBBBHHII",
            width,
            height,
            0,
            0,
            1,
            32,
            len(payload),
            offset,
        )
        offset += len(payload)
    return header + bytes(entries)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--icons-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "frontend" / "public" / "icons",
        help="Carpeta donde escribir los .ico",
    )
    args = parser.parse_args()

    icons_dir: Path = args.icons_dir
    icons_dir.mkdir(parents=True, exist_ok=True)

    outputs = {
        "s-hospital-app.ico": render_app_icon,
        "s-hospital-installer.ico": render_installer_icon,
        "s-hospital-maintenance.ico": render_maintenance_icon,
    }

    for filename, renderer in outputs.items():
        target = icons_dir / filename
        save_multiresolution_ico(target, renderer)
        print(f"  {filename}: {target.stat().st_size} bytes, {len(EXPECTED_SIZES)} resoluciones")

    legacy = icons_dir / "hospital-app.ico"
    if legacy.exists():
        backup = icons_dir / "hospital-app.ico.legacy"
        shutil.move(str(legacy), str(backup))
        print(f"  hospital-app.ico legado renombrado a {backup.name}")
    else:
        print("  hospital-app.ico legado: no estaba presente")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
