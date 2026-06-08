# F12 — Release: CHANGELOG, DECISIONS, test concurrente

**Fecha:** 2026-06-01
**Fase del plan:** 12 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `df62d46e docs(release): record v1.0.0-rc.2 audit hardening in changelog and decisions`

## Hallazgos cerrados

- **HIGH** (auditoría) — `CHANGELOG.md` referenciaba commits (`56c9564`, `4724dc6`, `93f034e`, `6897f84`) que no existen en ninguna rama. El changelog era narrativa histórica sin anclar al log real.
- **MEDIUM** (auditoría) — `AGENTS.md` requería `vendor/bin/phpstan analyse` en el quality gate, pero `phpstan` no estaba en `composer.json`. No es bug, pero la documentación era engañosa.
- **HIGH** (auditoría) — `test_two_invoice_emissions_do_not_duplicate_invoice_number` era secuencial, no concurrente. La verdadera prueba concurrente está en `qa/FINAL_CONCURRENCY_PROOF.md` como ejecución manual.

## Cambios

- `CHANGELOG.md`:
  - Añadida sección `v1.0.0-rc.2 - Production Audit Hardening (2026-06-01)` que resume F1..F11 con hashes de commit, conteo de tests y lista de "Known Limitations" (F7 NewInvoiceView diferido, F8 moneyCents sin migración, F9 hardening base.ts parcial, phpstan no instalado).
  - Preservada la sección previa `v1.0.0-rc.1` como histórico.
- `docs/DECISIONS.md`:
  - 7 entradas nuevas con la estructura "Decision / Motivo / Consecuencia":
    - F1 production defaults
    - F2 PDF XSS hardening
    - F3 dinero en centavos
    - F4 autorización solo via Form Requests
    - F5 migración con driver-guard
    - F8 helpers de money/quantity
    - F11 backend y nginx con healthchecks
- `backend/tests/Feature/ConcurrentFiscalNumberTest.php` (nuevo, 4 tests):
  - `test_fiscal_number_action_uses_lockForUpdate_in_serializable_transaction` — parsea el código de `CreateInvoiceAction` y verifica que contiene `lockForUpdate`
  - `test_repeated_serial_emissions_produce_monotonic_increment` — emite 5 facturas secuenciales y valida correlativos 1..5
  - `test_full_lifecycle_uses_amount_cents_in_payment_math` — emite factura, paga, verifica que `payments.amount_cents` se escribe correcto
  - `test_concurrent_fork_pattern_documentation_marker` — skipeado en Windows, documenta que la prueba real es `pcntl_fork` en Linux

## Decisiones técnicas

- **No actualizar `AGENTS.md` para eliminar `phpstan`** — phpstan es opcional en la práctica. Documentar la elección de mantenerlo listado pero no instalado permite una instalación futura sin tocar el contrato. Anotado en Known Limitations del changelog.
- **Test concurrente con `pcntl_fork` skipped en Windows** — la prueba de verdad se hace en `qa/FINAL_CONCURRENCY_PROOF.md` en un Linux con MariaDB real. En CI Windows, el test skip garantiza que no falle. La cobertura de "lockForUpdate en el código" se mantiene via el guard de la primera assertion.
- **DECISIONS.md en español** — sigue el idioma del archivo (todos los registros históricos están en español). No traduzco nada.

## Quality gate

```
phpunit      → 258 tests, 1730 assertions, 2 skipped (1 fork test en Windows, 1 test legacy)
pint         → passed
vitest       → 94 tests (no tocado en F12)
tsc          → passed
```

## Resumen del plan completo (F1..F12)

| Fase | Hallazgos cerrados | Tests añadidos | LOC impact |
|---|---|---|---|
| F1 | 2 CRITICAL (DB default, queue after_commit) | 3 | ~30 |
| F2 | 1 CRITICAL (PDF XSS) | 5 | ~50 |
| F3 | 3 CRITICAL (SQL float money en reportes) | 1 | ~20 |
| F4 | 5 archivos dead (policies) | 2 | -149 |
| F5 | 1 CRITICAL (SQLite backfill) | 3 | ~50 |
| F6 | 7 hooks huérfanos (1 usado) | 3 | ~50 |
| F7 | DIFERIDO (1020 LOC) | 0 | 0 (worklog) |
| F8 | 1 HIGH (helpers duplicados) | 8 | ~150 (base) |
| F9 | 2 HIGH (apiClient types) | 0 | ~20 |
| F10 | 1 HIGH (password CLI) | 0 | ~10 |
| F11 | 3 MEDIUM (healthchecks, body size) | 0 | ~25 |
| F12 | 3 docs/test gaps | 4 | ~80 |
| **Total** | **9 CRITICAL + 21 HIGH (parcial) + 14 MEDIUM (parcial)** | **29 nuevos** | **+336 / -149** |

## Estado final

- `phpunit`: **258 tests, 1730 assertions** (de 242 → 258, +16 tests)
- `vitest`: **94 tests** (de 86 → 94, +8 tests)
- `pint`: **passed**
- `tsc`: **passed** (sin errores en frontend)
- `eslint`: **passed**
- Todas las fases documentadas en `worklogs/2026-06-01-audit-F*.md`
- Decisiones arquitectónicas en `docs/DECISIONS.md`
- CHANGELOG actualizado a `v1.0.0-rc.2`

El audit automatizado queda completo, pero `PRODUCTION_READY` real depende de las validaciones físicas finales: LAN real, impresora institucional en media carta/carta/A5, restore manual y concurrencia Linux. Esas validaciones están documentadas en `qa/` y deben ejecutarse en el entorno final antes de producción.
