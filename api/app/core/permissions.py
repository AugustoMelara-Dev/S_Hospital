"""Permission catalog (stable codes, Spanish labels) and the 5 system roles (SPEC §3).

- ``ALL_PERMISSIONS``: every permission code.
- ``SYSTEM_ROLES``: ``{code: (label, frozenset(perms))}`` seeded by ``app.seed.seeder``.
- ``permission_catalog()``: grouped structure for ``GET /api/roles``.
- The ``admin`` role is treated as having every permission (even future ones).
"""

from __future__ import annotations

from typing import Any

# (module code, module label, [(permission code, label), ...])
PERMISSION_GROUPS: list[tuple[str, str, list[tuple[str, str]]]] = [
    ("settings", "Ajustes institucionales", [
        ("settings.view", "Ver ajustes institucionales"),
        ("settings.update", "Modificar ajustes, numeración fiscal e impuestos"),
    ]),
    ("catalog", "Catálogo y precios", [
        ("catalog.view", "Ver catálogo"),
        ("catalog.manage", "Administrar catálogo, precios e impuestos"),
    ]),
    ("invoices", "Facturas", [
        ("invoices.view", "Ver facturas"),
        ("invoices.create", "Emitir facturas"),
        ("invoices.operate_any", "Operar facturas de otros usuarios o días"),
        ("invoices.void", "Anular facturas"),
        ("invoices.reverse", "Revertir facturas cobradas"),
    ]),
    ("cash", "Caja", [
        ("cash.view", "Ver caja"),
        ("cash.open", "Abrir caja"),
        ("cash.close", "Cerrar caja propia"),
        ("cash.close_any", "Cerrar caja de otros usuarios"),
    ]),
    ("payments", "Cobros", [
        ("payments.create", "Registrar cobros"),
        ("payments.view", "Ver cobros"),
        ("payments.void", "Anular cobros"),
    ]),
    ("receipts", "Recibos", [
        ("receipts.view", "Ver recibos"),
        ("receipts.reprint", "Reimprimir recibos propios"),
        ("receipts.reprint_any", "Reimprimir recibos de otros usuarios"),
    ]),
    ("receipt_settings", "Impresión de recibos", [
        ("receipt_settings.view", "Ver ajustes de impresión"),
        ("receipt_settings.update", "Modificar series y perfiles de impresión"),
    ]),
    ("reports", "Reportes", [
        ("reports.own", "Ver reportes propios"),
        ("reports.all", "Ver reportes de todos"),
        ("reports.export", "Exportar reportes"),
    ]),
    ("users", "Usuarios y permisos", [
        ("users.view", "Ver usuarios y roles"),
        ("users.manage", "Administrar usuarios y roles"),
    ]),
    ("backups", "Respaldos", [
        ("backups.view", "Ver respaldos"),
        ("backups.create", "Crear respaldos"),
        ("backups.download", "Descargar respaldos"),
    ]),
    ("system", "Sistema y auditoría", [
        ("audit.view", "Ver auditoría"),
        ("system.status", "Ver estado del sistema"),
    ]),
    ("patients", "Pacientes", [
        ("patients.mark_dialysis_prescription", "Marcar receta de diálisis"),
    ]),
]

PERMISSION_LABELS: dict[str, str] = {
    code: label for _, _, perms in PERMISSION_GROUPS for code, label in perms
}
ALL_PERMISSIONS: frozenset[str] = frozenset(PERMISSION_LABELS)


def _expand(*patterns: str) -> frozenset[str]:
    """Expand ``"catalog.*"`` style patterns into concrete permission codes."""
    out: set[str] = set()
    for pattern in patterns:
        if pattern.endswith(".*"):
            prefix = pattern[:-1]
            matches = {p for p in ALL_PERMISSIONS if p.startswith(prefix)}
            if not matches:
                raise ValueError(f"Patrón de permiso sin coincidencias: {pattern}")
            out |= matches
        else:
            if pattern not in ALL_PERMISSIONS:
                raise ValueError(f"Permiso desconocido: {pattern}")
            out.add(pattern)
    return frozenset(out)


ADMIN_ROLE = "admin"

SYSTEM_ROLES: dict[str, tuple[str, frozenset[str]]] = {
    "admin": ("Administración", ALL_PERMISSIONS),
    "supervisor": ("Supervisión", _expand(
        "settings.view", "catalog.*", "invoices.*", "cash.*", "payments.*", "receipts.*",
        "receipt_settings.view", "reports.all", "reports.export", "audit.view",
    )),
    "auditor": ("Auditoría", _expand(
        "settings.view", "catalog.view", "invoices.view", "cash.view", "payments.view",
        "receipts.view", "reports.all", "backups.view", "audit.view",
    )),
    "soporte": ("Soporte técnico", _expand(
        "system.status", "receipt_settings.view", "receipt_settings.update", "backups.view",
    )),
    "cajero": ("Caja", _expand(
        "catalog.view", "invoices.view", "invoices.create", "cash.view", "cash.open",
        "cash.close", "payments.create", "payments.view", "receipts.view", "receipts.reprint",
        "reports.own", "patients.mark_dialysis_prescription",
    )),
}


def is_valid_permission(code: str) -> bool:
    return code in ALL_PERMISSIONS


def permission_catalog() -> list[dict[str, Any]]:
    """``[{module, label, permissions:[{code,label}]}]`` for the roles editor."""
    return [
        {
            "module": module,
            "label": label,
            "permissions": [{"code": c, "label": lbl} for c, lbl in perms],
        }
        for module, label, perms in PERMISSION_GROUPS
    ]
