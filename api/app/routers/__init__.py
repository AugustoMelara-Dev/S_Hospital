"""API routers. Each module exports ``router``; ``app.main`` mounts them under ``/api``."""

from app.routers import (
    auth,
    cash,
    catalog,
    invoices,
    public,
    receipts,
    reports,
    settings,
    system,
    users,
)

ALL_ROUTERS = [
    public.router,
    auth.router,
    settings.router,
    catalog.router,
    cash.router,
    invoices.router,
    receipts.router,
    reports.router,
    users.router,
    system.router,
]

__all__ = ["ALL_ROUTERS"]
