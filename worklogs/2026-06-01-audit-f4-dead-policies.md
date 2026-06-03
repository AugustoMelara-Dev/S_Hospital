# F4 — Producción: eliminar policies muertas

**Fecha:** 2026-06-01
**Fase del plan:** 4 de 12
**Rama:** `codex/audit-f1-config-hardening`
**Commit:** `16c6d70b refactor(backend): remove dead policies in favor of form request authz`

## Hallazgos cerrados

- **CRÍTICO** `app/Policies/CashRegisterSessionPolicy.php:13-30` — `viewAny` y `create` retornaban `true` incondicionalmente. Si las policies se hubieran auto-registrado (vía `Gate::policy()` o auto-discovery de Laravel), cualquier usuario autenticado podría haber listado o creado sesiones de caja de otros cajeros.
- **CRÍTICO** (general) — 5 policy classes (`InvoicePolicy`, `PaymentPolicy`, `CashRegisterSessionPolicy`, `FiscalSettingPolicy`, `BackupPolicy`) estaban **muertas**: nunca se llamaron con `Gate::policy()` ni con `$user->can('view', $model)`. La autorización se hacía de forma consistente vía `Form Request::authorize()` y string permissions (`$user->can('invoices.view')`).

## Cambios

- Eliminé los 5 archivos en `app/Policies/`.
- Eliminé el directorio `app/Policies/` (vacío).
- Añadí `tests/Unit/AuthorizationStrategyTest` con 2 guard tests:
  - `app/Policies` no debe existir
  - `AppServiceProvider` no debe contener `Gate::policy(` sin policies que correspondan

## Decisiones técnicas

- **Eliminar, no registrar** — la estrategia de authz actual (Form Requests + string permissions) es consistente y está cubierta por tests. Las policies tenían además defaults peligrosos. Eliminar es la opción más segura y reversible.
- **Guard test** — los tests parsean el filesystem y el código de `AppServiceProvider` para detectar regresiones si alguien re-introduce la carpeta sin wirear las policies. Cuesta 0 mantenerlo.
- **DECISIONS.md** — la decisión de mantener "Form Requests + permissions" como única estrategia se documentará en F12 junto con el resto.

## Quality gate

```
phpunit      → 251 tests, 1715 assertions OK
```

## Próxima fase

F5 — SQLite guard en `2026_06_01_000001_add_amount_cents_to_payments_table.php` para que los tests con SQLite RefreshDatabase no fallen por el `CAST(amount * 100 AS SIGNED)` MySQL-only.
