# PRUEBAS — Registro de ejecución real

Regla: cada entrada indica fecha, raíz, comando exacto, entorno, salida resumida y estado. Lo no ejecutable se declara.

## Entorno local (2026-09-13)

- PHP 8.2.12 CLI; Node 24.19.0; pnpm 11.6.2; npm presente.
- `composer` ausente del PATH. `backend/vendor` y `frontend/node_modules` ausentes.
- Docker CLI 29.x instalado; daemon apagado (`npipe dockerDesktopLinuxEngine` no disponible).
- **[SUPERADO 2026-09-17]** ~~Prohibido: Playwright/Puppeteer/`test:e2e` (restricción del propietario).~~
  El mandato vigente **autoriza** la QA local con Playwright/E2E y datos sintéticos mediante
  runner acotado. Las mediciones de esta tabla anteriores al 2026-09-17 son fotografía de su
  fase; el estado vigente está en `CIERRE.md` y en las secciones C1 de este archivo.

## Ejecuciones

| Fecha | Tarea | Comando | Entorno | Resultado | Evidencia |
|---|---|---|---|---|---|
| 2026-09-13 | Preflight | `git rev-parse HEAD; git status --porcelain` | raíz aislada | HEAD baa41f97; 1 M + 2 untracked; sin commits | ESTADO.md |
| 2026-09-13 | Preflight | `opencode --version`; `opencode agent list` | host | 1.18.30; 13 hs-* registrados | AGENTES.jsonl |
| 2026-09-13 | RECON-002 | Lectura estática de CI/TestCase/specs (sin suites) | raíz aislada | Driver efectivo = SQLite; fix identificado; tools: php 8.2.12, node 24.19, composer.phar XAMPP 2.10.1; vendor/node_modules ausentes; MariaDB XAMPP 10.4.32 local activo | ses_f63801908ffeoB5oDg9oo4ZcPi |
| 2026-09-13 | T1-001 | Suites PowerShell recovery (recovery_runtime 48, recovery_docker 23, recovery_console 26, pre_installation_maintenance_audit 42, production_recovery 18, recovery_contract 12, recovery_validation 16; restore -SelfTest) | host PS 5.1 | PASS; Docker real no ejecutado (daemon apagado) | hospital-ai/evidencia/T1-001/INFORME.md |
| 2026-09-13 | T1-002 | Barrido scripts\*.test.ps1 21/21; PHPUnit VerifyMigrationBackupCommandTest 8/21 + Console 10/52; smoke guard EXIT=1 | host PS + SQLite | PASS; docker load/exec real no ejecutado | hospital-ai/evidencia/T1-002/INFORME.md |
| 2026-09-13 | T1-003 | Baseline backend `php artisan test` | SQLite :memory | 940 warnings (artefacto .env ausente), 1 skip, 53 pass, 7344 asserts, exit 0, 356.15s | hospital-ai/evidencia/T1-003/backend-sqlite.log |
| 2026-09-13 | T1-003 | Subset MariaDB real (triggers/constraints/locks/idempotencia/guard) | MariaDB XAMPP 10.4.32, DB `s_hospital_test_t1003` | 61 tests, 197 asserts, 2 fallos preexistentes (HS-QA-01/02), 3 skips, 167.6s; base y usuario temporales eliminados | hospital-ai/evidencia/T1-003/mariadb-subset.log |
| 2026-09-13 | T1-003 | Guard driver negativo (flag=1 + sqlite) | SQLite | exit 1 con "active driver is 'sqlite'" | mariadb-driver-probe.log |
| 2026-09-13 | T1-003 | Frontend typecheck/lint/vitest/build (corepack pnpm 11.7.0) | node 24.19 | todo exit 0; vitest 154 files/1162 tests, 225.9s; build 28.7s | hospital-ai/evidencia/T1-003/frontend-*.log |
| 2026-09-13 | T1-005 | Suite PHPUnit completa (claim, sin log crudo) | SQLite :memory | 1005 tests, 7455 asserts, 0 fallos, 13 skips, 5:29 | Reabierto: T2-001 exige log crudo (RV-T1-005 EVIDENCIA_INSUFICIENTE) |
| 2026-09-13 | T2-002 | Subset MariaDB + race 2 procesos Windows | MariaDB XAMPP 10.4.32, DB s_hospital_test_t2002 | 61 tests, 194 asserts, 0 fallos, 4 skips, 391.7s, exit 0; race ✔; base eliminada | hospital-ai/evidencia/T2-002/mariadb-subset.log |
| 2026-09-13 | T2-002 | Suite rápida SQLite completa | SQLite | 6 fallos en vuelo (5 Console WIP T2-011 + 1 por ediciones concurrentes que pasa aislado) | hospital-ai/evidencia/T2-002/backend-sqlite.log |
| 2026-09-13 | T2-007 | Suites recovery (deuda P3) | host PS 5.1 | 8 suites EXIT=0 (48/23/43/55/18/12/16/15), -SelfTest, parseo 11 archivos | hospital-ai/evidencia/T2-007/ |
| 2026-09-13 | T2-004 | Sintéticas F013/F017/F020 + probe FK/trigger | MariaDB XAMPP 10.4.32, DB s_hospital_test_db_t2004 (eliminada) | ~40 casos con resultado esperado; CHECK monetario probado; SET time_zone 1298; -06:00 OK | hospital-ai/evidencia/T2-004/synthetic-results.log |
| 2026-09-13 | T2-003b | Frontend ola 1: typecheck/lint/vitest unit/build | node 24.19, corepack pnpm 11.7 | Todo exit 0; 156 archivos/1179 tests (399.9s); build 1524 módulos 14.79s; tokens operativos en CSS del build | hospital-ai/evidencia/T2-003/frontend-*.log |
| 2026-09-13 | T2-005 | Specs E2E realineadas: ESLint + tsc e2e + mock-plan test | host node | ESLint 12 archivos exit 0; node --test plan 1 pass; tsc e2e exit 0 (sin navegador) | hospital-ai/evidencia/T2-005/ |
| 2026-09-13 | Pendiente | Console + suite rápida tras T2-011 | SQLite | Completado (T2-013): 1045/7554/0F/31S, Console 13/13 | hospital-ai/evidencia/T2-013/ |
| 2026-09-13 | Pendiente | Ola 1 migraciones F013/F017 en base desechable | MariaDB | Completado (T2-014): aceptado con observaciones bajas (RV-T2-014); aplicación real pendiente | hospital-ai/evidencia/T2-014/ |
| 2026-09-13 | T2-023/T2-035 | Frontend historial + motivo reimpresión | node 24.19, corepack pnpm | typecheck/lint/build exit 0; vitest dirigido 150 tests | hospital-ai/evidencia/T2-023/, T2-035/ |
| 2026-09-13 | T2-030 | composer/pnpm audit + guards | PHP 8.2.12, pnpm 11 | 27->0 advisories composer; 44->0 pnpm; suite unit 156/1201; subset PHPUnit 261/3554 | hospital-ai/evidencia/T2-030/ |
| 2026-09-13 | T2-037 | Reconciliación post-restore | SQLite + MariaDB desechable s_hospital_test_t2037 (eliminada) | SQLite 31/142 y 96/621; MariaDB 24/133; CLI auditado; phpstan/pint OK | hospital-ai/evidencia/T2-037/ |
| 2026-09-13 | T2-038 | Guard copia externa | SQLite + MariaDB desechable s_hospital_test_t2038 (eliminada) | 155/741 SQLite; 29/158 MariaDB; CLI real; phpstan/pint OK | hospital-ai/evidencia/T2-038/ |
| 2026-09-13 | T2-040 | F016 fase 1 + F014 deprecación | MariaDB desechable s_hospital_test_t2040 (eliminada) | migrate/seed/rollback/reapply exit 0; 25/68 MariaDB; 20/40 SQLite | hospital-ai/evidencia/T2-040/ |
| 2026-09-13 | T2-036/T2-039 | Wiring copia externa + docs DB_TIMEZONE | sin daemon Docker (solo `docker compose config`) | contrato 97 checks; PS 23/23; PHPUnit 22/221 | hospital-ai/evidencia/T2-036/, T2-039/ |
| 2026-09-14 | Revisiones | 6 RV lanzadas; 4 cerradas: RV-T2-030 y RV-T2-036b ACEPTABLE; RV-T2-037 y RV-T2-041b REQUIERE_CAMBIOS (fixes T3-005/T3-008); RV-T2-038 y RV-T2-023b relanzadas | solo lectura | veredictos en `hospital-ai/evidencia/revisiones/` | AGENTES.jsonl |
