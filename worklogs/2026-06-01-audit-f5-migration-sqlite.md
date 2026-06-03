# F5 — Producción: SQLite guard en migración de amount_cents

**Fecha:** 2026-06-01
**Fase del plan:** 5 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `166106b8 fix(db): make amount_cents migration safe for non-mysql drivers`

## Hallazgos cerrados

- **CRÍTICO** `database/migrations/2026_06_01_000001_add_amount_cents_to_payments_table.php:16` — `CAST(amount * 100 AS SIGNED)` es sintaxis MySQL/MariaDB. Los tests con `RefreshDatabase` sobre SQLite in-memory fallarían con `no such function: SIGNED` y, peor, si alguien corre `migrate` en una BD no-MySQL en producción, la migración explota.
- **MEDIO** — La migración no era idempotente: si la corrida anterior falló entre el `add column` y el `change()`, re-ejecutarla lanzaba "Column already exists".

## Cambios

- `database/migrations/2026_06_01_000001_add_amount_cents_to_payments_table.php`:
  - Guard `Schema::hasColumn` al inicio del `up()` y al inicio del `down()` para re-ejecución segura.
  - Detección de driver: `mysql|mariadb` usa el `CAST` nativo; el resto usa PHP `round((float)$amount * 100)` con `chunkById(500)` para limitar memoria.
- `tests/Feature/AmountCentsMigrationTest.php` (nuevo):
  - `test_amount_cents_column_exists_after_refresh` — verifica que la columna existe tras `RefreshDatabase` en SQLite
  - `test_migration_uses_driver_safe_backfill_path_on_non_mysql` — parsea el código fuente de la migración y verifica que contiene el guard del driver

## Decisiones técnicas

- **No usar `doctrine/dbal`** — Laravel 12 ya no lo requiere para `->change()`. Verificado que sin `doctrine/dbal` instalado, los tests pasan con el `change()`. Mantener la dependencia fuera de `composer.json` ahorra ~5MB y evita un attack surface adicional.
- **`chunkById(500)` para el backfill en no-MySQL** — en SQLite la transacción implícita puede ser grande si la tabla `payments` tiene millones de filas. `chunkById(500)` mantiene la memoria RAM baja.
- **`round()` antes de `(int)` cast** — para `0.10 * 100`, PHP da `10.000000000000002` por float. `round()` evita el drift.

## Quality gate

```
phpunit      → 254 tests, 1717 assertions OK (1 skip)
pint         → passed
```

## Próxima fase

F6 — Refactor de hooks TanStack Query: hacer que `useInvoices`, `useCashSession`, `useCategories`, `useServices`, `useBackups`, `useKeyboardShortcuts`, `useClock` se usen realmente en las vistas. Trabajo grande pero correcto a largo plazo.
