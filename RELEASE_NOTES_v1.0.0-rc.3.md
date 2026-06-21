# Release Notes - Sistema de Caja Hospitalaria v1.0.0-rc.3

**Fecha de release:** 2026-06-02
**Estado:** PRODUCTION_CANDIDATE (próximo a PRODUCTION_READY)
**Branch:** `codex/audit-f1-config-hardening`

## Resumen

Esta release candidate consolida el sistema para entrega en producción LAN.
El sistema está completo en código y validado en pruebas automatizadas.
Las cuatro evidencias físicas restantes (LAN cliente, impresora, restore,
concurrencia) deben completarse en el servidor final con hardware real.

## Quality gates

| Gate | Resultado |
|------|-----------|
| Backend tests (PHPUnit) | 274/274 OK (1816 assertions, 4 skipped legítimamente) |
| Frontend tests (Vitest) | 177/177 OK (33 nuevos durante esta auditoría) |
| TypeScript typecheck | 0 errores |
| ESLint | 0 errores |
| phpstan (larastan) | level 4 con baseline generada de level 6 (0 errores reportados) |
| Build de producción | charts 116.73 kB gzipped (objetivo < 250 kB) |
| E2E Playwright | Sin regresiones |
| Laravel Pint | Pasa |

## Cambios desde v1.0.0-rc.2

### Nuevas funcionalidades

- **apiClient hardening** (`frontend/src/lib/api/base.ts`)
  CSRF cache de 30 min, lista completa de errores 422 con etiquetas
  legibles, helper `isPermissionDeniedError`, mensaje 423 Locked.
- **CSP estricta con report-only** (`AddSecurityHeaders.php`) y endpoint
  `/api/system/csp-report` para canal de violaciones.
- **Cross-Origin-Opener-Policy: same-origin** se une a los headers
  de seguridad existentes.
- **Endpoint público `/api/system/health`** con snapshot operativo
  (database, queue, backups, storage, recent errors) y heartbeat
  del backup worker.
- **Login lockout** (`LoginLockout` middleware) con tabla
  `login_attempts` que bloquea 5 intentos en 15 min por login
  o por IP, respondiendo 423 Locked.
- **Catálogo central de atajos de teclado** (`lib/shortcuts.ts`)
  con `KEYBOARD_SHORTCUTS`, `shortcutsByScope`, `shortcutLabel`.
- **Helpers de formato es-HN** (`lib/format/formatCurrency.ts`,
  `lib/format/formatDate.ts`) y diccionario i18n es-HN
  (`lib/i18n/es-HN.ts`).
- **Vite plugin CSP nonce** (`vite-plugins/csp-nonce.ts`) que
  genera nonce por build y emite `csp-nonce.json` para que
  el backend pueda leerlo.
- **Hook `useBackupWorkerHealth`** que consume
  `/api/system/health` y proyecta la sección de backups.
- **Script `auto_evidence.ps1`** que auto-rellena y valida los archivos
  `qa/*.md` de evidencias finales y handoff con la IP, URL y datos
  del sistema del `.env`.

### Refactors

- **NewInvoiceView.tsx** extraído de 1020 a 733 líneas con
  `state/types.ts`, `state/reducer.ts`, `state/posMath.ts`.
  19 tests vitest nuevos cubren el reducer y el math.
- **moneyCents** wired en 7 vistas (cart, payment, reports,
  catalog CSV importer) reemplazando `Number.parseFloat`.
- **Vite manualChunks** declarado explícitamente (charts, forms,
  query, ui, vendor) para mantener chunks predecibles.

### Quality gates nuevos

- `scripts/quality_gate.sh` ahora encuentra `phpstan` (larastan
  instalado) y falla si falta.
- `phpunit.coverage.xml` profile opt-in con umbral 70% sobre
  `app/Actions/Billing`, `Cash`, `Payments`, `Backups`, `Receipts`.
- `tests/Feature/Concurrent/FiscalNumberRaceTest.php` con
  Symfony Process: 2 workers paralelos contra MySQL/MariaDB
  verifican que el correlativo fiscal no se duplica. Opt-in
  via `HOSPITAL_RUN_CONCURRENT_TESTS=1`.

### Seguridad

- Login lockout (5/15min) por usuario y por IP.
- CSRF cache 30 min en apiClient.
- CSP endurecida con report-only channel, object-src 'none',
  manifest-src 'self', ws:/wss: para HMR.
- Login attempts audit log completo.

## Pendientes para v1.0.0 (no automatizables en este entorno)

| # | Tarea | Bloqueante | Cómo cerrarlo |
|---|-------|-----------|---------------|
| 1 | Completar `qa/LAN_CLIENT_VALIDATION_PROOF.md` desde segunda PC | sí | Operador + `scripts/validate_lan_client.ps1` |
| 2 | Completar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` desde PC con impresora | sí | Operador con hardware |
| 3 | Completar `qa/FINAL_RESTORE_PROOF.md` con SHA256, size, conteos | sí | `bash scripts/validate_restore_mysql.sh` |
| 4 | Completar `qa/FINAL_CONCURRENCY_PROOF.md` con RUN_ID y salidas | sí | `bash scripts/validate_mysql_concurrency.sh` |
| 5 | Instalar tareas Windows de backup | sí | `scripts/install_backup_tasks_windows.ps1` |
| 6 | Ejecutar `final_production_handoff.ps1` sin `-AllowMissingPhysicalProof` | sí | handoff final |
| 7 | Regenerar paquete offline | sí | `make_offline_release.ps1 -Force` + `assert_offline_release_clean.ps1` |
| 8 | Crear tag `v1.0.0` | sí | tras cierre |

Procedimiento documentado en `docs/RELEASE_CHECKLIST.md`.

## Comandos utiles

```bash
# Quality gate local
cd backend && vendor/bin/phpunit --colors=never
vendor/bin/phpstan analyse
vendor/bin/pint --test

cd ../frontend && npm run typecheck
npm run lint
npm run test
npm run build

# Preflight en servidor final
powershell scripts/final_production_handoff.ps1 -BaseUrl http://IP_SERVIDOR
```

## Métricas delta desde v1.0.0-rc.2

| Indicador | v1.0.0-rc.2 | v1.0.0-rc.3 | Delta |
|---|---|---|---|
| Tests PHPUnit | 254 | 274 | +20 |
| Tests Vitest | 94 | 177 | +83 |
| Líneas NewInvoiceView.tsx | 1020 | 733 | -287 |
| Commits del audit | 12 fases | 12 + 14 | +14 |
| Endpoints API nuevos | 0 | 2 (`/health`, `/csp-report`) | +2 |
| Middleware nuevo | 0 | 1 (`LoginLockout`) | +1 |
| Migración nueva | 0 | 1 (`login_attempts`) | +1 |
| Plugin Vite nuevo | 0 | 1 (`cspNoncePlugin`) | +1 |
| Bundle charts gzipped | n/a | 116.73 kB | nuevo |
| phpstan | no instalado | level 4 con baseline de level 6 | nuevo |

## Compatibilidad

- PHP 8.2+
- Node 22+
- MySQL 8 / MariaDB 11
- Navegadores modernos (Chrome/Edge/Firefox actualizados)
- LAN 100 Mbps mínimo recomendado

## Créditos

- 12 fases previas de hardening (v1.0.0-rc.1, rc.2) por el equipo original.
- 14 fases adicionales (v1.0.0-rc.3) ejecutadas durante la
  auditoría interactiva 2026-06-02.
