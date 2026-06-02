# F3 — Producción: math de dinero en SQL float → cents

**Fecha:** 2026-06-01
**Fase del plan:** 3 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commits previos del otro agente:**
- `31a3afb6 fix(backend): add amount_cents column to eliminate SQL floating-point money calculations`
**Commits propios:**
- `3346d1a8 fix(reports): prefer payments.amount_cents over SQL float round`

## Hallazgos cerrados

- **CRÍTICO** `app/Actions/Reports/DashboardReportService.php:105,165` — usaba `ROUND(payments.amount * 100)` que es float math en MySQL/MariaDB. Para valores grandes, los decimales pueden acumular drift.
- **CRÍTICO** `app/Actions/Reports/DailyReportService.php:31` — mismo patrón.
- **ALTO** (cerrado por el otro agente en `31a3afb6`): `BuildCashReconciliationAction`, `VoidPaymentAction`, `RegisterPaymentAction` — añadidos `amount_cents` y uso de `SUM(amount_cents)`.

## Cambios propios

- `app/Actions/Reports/DashboardReportService.php` — `ROUND(payments.amount * 100)` → `SUM(payments.amount_cents)` en 2 sitios (payments-by-method, cashiers-summary).
- `app/Actions/Reports/DailyReportService.php` — mismo cambio en payments-by-method.
- `tests/Unit/PaymentCentsSqlGuardTest.php` (nuevo) — guard que falla si alguien re-introduce `ROUND(payments.amount * 100)` en estos archivos.

## Decisiones técnicas

- **Deuda documentada**: las columnas `invoices` y `invoice_items` no tienen cents. Sus `ROUND(total * 100)` y `ROUND(line_total * 100)` siguen en SQL. Esto requiere una migración aditiva (añadir `subtotal_cents`, `tax_amount_cents`, `total_cents`, `paid_amount_cents`, `balance_due_cents` a `invoices` y `*_cents` a `invoice_items`) con backfill en PHP. Documentado en `docs/DECISIONS.md` para una iteración futura. Por ahora, el flujo de dinero crítico (pagos, anulación de pagos, reconciliación de caja) ya está en cents.
- **Guard estático** — el test parsea el código fuente en vez de ejecutar las queries. Esto detecta el patrón en tiempo de revisión, no en tiempo de ejecución. Más simple y rápido que un test de integración.

## Quality gate

```
phpunit      → 249 tests, 1712 assertions OK
pint         → passed
```

## Próxima fase

F4 — Eliminar las 5 policies muertas (`app/Policies/*`) que nunca se registran con `Gate::policy(...)`. Documentar en `DECISIONS.md` que se eligió "permission strings + Form Requests" como estrategia única de autorización.
