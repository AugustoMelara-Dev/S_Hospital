"""Domain services (business logic). Routers stay thin and call into these modules.

Convention: service functions receive ``db: Session`` and the acting ``User``,
raise ``app.core.errors.AppError`` subclasses on rule violations, write audit rows
with ``app.core.audit.audit`` and leave the final ``db.commit()`` to the caller
(router or ``Idempotency.respond``) unless documented otherwise.
"""
