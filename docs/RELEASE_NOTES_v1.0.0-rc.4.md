# Release notes v1.0.0-rc.4 (Production Candidate 4)

**Fecha:** 2026-06-02
**Branch:** `codex/audit-f1-config-hardening`
**Estado:** PRODUCTION_CANDIDATE → bloqueado en PRODUCTION_READY
por las 4 evidencias físicas de FASE G (requieren el servidor
final con hardware real).

## Resumen

El branch v1.0.0-rc.4 cierra los 9 hallazgos CRITICAL
identificados por la auditoría del 2026-06-02 (backend,
frontend, base de datos, infraestructura, tests, docs) y
añade hardening técnico adicional (sync real-time, tuning
de php-fpm, Policies, refactor de TanStack Query, código
muerto eliminado, recompute defensivo de cents, nueva
documentación operativa).

## Cambios desde v1.0.0-rc.3

### Seguridad y secretos (CRIT-1, CRIT-9)

- Pre-commit guard ampliado para detectar
  `HOSPITAL_LICENSE_SALT`, `HOSPITAL_INITIAL_ADMIN_PASSWORD`,
  archivos `.env`, y `nginx/ssl/`. 15 tests (era 8).
- `Update-DotEnv` y `env_helpers.ps1` siempre escriben con
  `-Encoding ASCII`. 9 tests de PowerShell.
- Dev `APP_KEY` rotado. Log en `docs/SECRETS.md`.

### Backend (CRIT-2, CRIT-4, CRIT-5, A8, C6, B7)

- `POST /api/invoices/{id}/reverse` con permiso
  `invoices.reverse`. Void de cada pago + recalc de
  invoice + void de invoice, todo en una transacción.
  7 tests nuevos en `InvoiceReverseTest`.
- `active_document_type` UNIQUE index documentado y
  probado (3 tests nuevos en `GenerateFiscalNumberActionTest`).
- Real-time broadcast: `InvoiceChanged`, `PaymentChanged`,
  `CashSessionChanged` emitidos en `DB::afterCommit`. Soketi
  sidecar en `docker-compose.prod.yml`. 6 tests en
  `BroadcastingWiringTest`.
- Recompute defensivo de `payments.amount_cents` a
  `UNSIGNED` (prevención de truncamiento 32-bit).
- `App\Policies\InvoicePolicy` y `CashSessionPolicy`.
  `Gate::policy()` registrado. `AuthorizationStrategyTest`
  invertido.
- Scheduler real: comando `hospital:scheduler-tick` +
  tabla `scheduler_ticks`. Heartbeat en
  `data.backups.queue.scheduler_heartbeat`.

### Frontend (A7, F1, F2)

- Toasts: `onStatus` ahora también dispara `react-hot-toast`
  (clasificado por heurística error/info/operación).
  5 tests nuevos en `user-error.test.ts`.
- `InvoiceHistoryView` migrado a TanStack Query
  (`useInvoices(filters)`). El refetch automático por
  cambio de filter reemplaza la cadena manual
  `setFilters + await loadInvoices`.
- `useBroadcastSync()` montado en `AppShell`: 5 canales
  WebSocket con invalidación cross-PC de queries
  TanStack Query.
- Código muerto eliminado: `useClock` (sin uso),
  `app-kicker` (CSS vacía), `needsBillingCashBootstrap` y
  `cashBootstrapLoading` (siempre false).

### Infra y despliegue (A4, A5, A6, D6, D1, D2)

- `bcmath` agregado a `backend/Dockerfile` y
  `backend/Dockerfile.prod`. AGENTS.md cumplimiento.
- Sidecar `scheduler` con `supercronic:v1.2.3` en
  `docker-compose.prod.yml`. Healthcheck.
- Sidecar `soketi` con `soketi/soketi:1.6-16-alpine` en
  `docker-compose.prod.yml`. Healthcheck.
- PHP-FPM pool tuned: `pm=static`, `pm.max_children=8`,
  `pm.max_requests=500`, log a stdout. `docker/php-fpm.conf`
  nuevo.
- Pipeline CI/CD en `.github/workflows/ci.yml` y
  `release.yml` (backend-SQLite, backend-MariaDB, frontend,
  e2e-mocked). 4 jobs paralelos con `concurrency` collapse.
- `scripts/register_scheduler_cron.ps1` (Windows scheduled
  task para el scheduler Laravel).
- `scripts/refresh_lan_ip.ps1` (re-aplica IP si cambia el
  DHCP).
- `scripts/smoke_test_post_install.ps1` (8 HTTP smoke
  tests post-instalación con auth round-trip).

### Documentación (F5, F6)

- `docs/00_README.md` - índice maestro.
- `docs/TROUBLESHOOTING.md` - 10 errores frecuentes
  mapeados a causa y fix.
- `docs/OPERATIVE_NOTES_2026_06_02.md` - snapshot v1.0.0.
- `docs/CI.md` - descripción del pipeline.
- `CHANGELOG.md` actualizado con la lista de CRITICAL.

## Métricas

- **PHPUnit:** 380/380 pass (4 MariaDB-only skipped en SQLite)
- **Vitest:** 217/217 pass
- **TypeScript:** 0 errors
- **ESLint:** 0 errors, 27 warnings (jsx-a11y, react-hooks)
- **PHPStan:** nivel 5 con 0 errors (nivel 6 + burndown baseline
  en v1.1)
- **Bundle gzipped:** < 250 kB

## Bloqueantes para `v1.0.0` final

`scripts/production_readiness_preflight.ps1` falla este tag en
los siguientes ítems (FASE G), todos requiriendo el servidor
final con hardware real:

1. `qa/LAN_CLIENT_VALIDATION_PROOF.md` - validación desde
   segunda PC LAN.
2. `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` - impresión
   física en 5 tamaños.
3. `qa/FINAL_RESTORE_PROOF.md` - backup desde UI → restore
   en base descartable, validar SHA256 + conteos.
4. `qa/FINAL_CONCURRENCY_PROOF.md` - doble apertura de caja,
   doble facturación, doble pago concurrente.

`qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` debe contener
`PRODUCTION_READY=YES` para que el release se publique.

## Upgrade path desde v1.0.0-rc.3

1. `git pull origin codex/audit-f1-config-hardening`
2. `git checkout v1.0.0-rc.4`
3. `docker compose down`
4. `docker compose -f docker-compose.prod.yml up -d`
   (los servicios nuevos `scheduler` y `soketi` se
   levantan automáticamente)
5. `php artisan db:seed --class=RolesAndPermissionsSeeder --force`
   (agrega el permiso `invoices.reverse` a los roles
   existentes)

No hay cambios de schema destructivos. Las migraciones
nuevas son idempotentes.
