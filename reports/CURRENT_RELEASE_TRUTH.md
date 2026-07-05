# Current Release Truth - S_Hospital

Fecha de verificacion inicial: 2026-06-15

## Actualizacion 2026-07-05

Esta seccion corrige evidencia obsoleta sin declarar produccion lista.

- Rama actual verificada: `codex/refactor-total`.
- HEAD actual verificado: `1c66a4e4d3a0268631dcaeaafaa60d8ebbf1ae39`.
- Ultimo commit verificado: `1c66a4e4 test(e2e): make button smoke qa reproducible`.
- `docker compose exec backend composer validate --no-interaction`: PASO, `./composer.json is valid`.
- `docker compose exec backend composer audit --no-interaction`: PASO, `No security vulnerability advisories found.`
- `composer validate/audit` ya no es un bloqueante cuando se ejecuta en el contenedor backend soportado.
- `npm.cmd run e2e` ya no falla por password seed; ahora falla temprano por preflight si falta `backend/vendor/autoload.php` en el host. El camino containerizado de navegador tiene evidencia fresca en `docs/testing-report.md`.
- `qa/production-audit/button-smoke-report.json` fue regenerado el 2026-07-05 con 79 resultados `passed`.
- El estado global sigue siendo `NOT_READY`: faltan `npm audit` vigente, cierre del worktree, evidencia fisica LAN/impresora/restore/backup worker, configuracion production real, admin real y paquete offline final.

## 1. HEAD actual

- HEAD: `605d2bcac0678e88d1b9e4c21055a8775f8e25f0`
- Ultimo commit: `605d2bca merge: final security lan hardening release candidate`

## 2. Rama actual

- Rama: `hardening-audit-complete-2026-06-15`

## 3. Estado git

Resultado de `git status --short --untracked-files=all`: worktree sucio.

Archivos modificados principales:

- `.github/workflows/ci.yml`
- `CHANGELOG.md`
- Backend: acciones de backups, billing, receipts, reports, comandos, middleware, requests, modelo User, rutas, seeders y tests.
- Docs: backup/restore, CI, decisions, disaster recovery, fiscal rules, HTTPS, release checklist, secrets.
- Frontend: areas, receipts, hooks, API base/billing y tests.
- Scripts: `production_readiness_preflight.ps1`, `restore_hospital_windows.ps1`.
- `AGENTS.md` y `docs/00_README.md` fueron corregidos en esta reconciliacion.

Archivos no rastreados principales:

- `backend/app/Actions/Backups/EncryptBackupFileAction.php`
- `backend/app/Console/Commands/DecryptBackupCommand.php`
- `backend/app/Console/Commands/PruneIdempotencyKeysCommand.php`
- `backend/app/Support/ExcelSafe.php`
- Migraciones `2026_06_15_000001` a `2026_06_15_000003`
- Tests nuevos backend/frontend
- `subagents/16_*.md` a `subagents/30_*.md`
- `worklogs/2026-06-15-audit-infra-deployment.md`
- `reports/CURRENT_RELEASE_TRUTH.md`

## 4. Comandos ejecutados

| Comando | Directorio | Resultado | Salida exacta/resumen verificable |
| --- | --- | --- | --- |
| `git branch --show-current` | repo | PASO | `hardening-audit-complete-2026-06-15` |
| `git rev-parse HEAD` | repo | PASO | `605d2bcac0678e88d1b9e4c21055a8775f8e25f0` |
| `git status --short --untracked-files=all` | repo | PASO | Worktree sucio con archivos modificados y no rastreados listados arriba. |
| `git log --oneline -5` | repo | PASO | `605d2bca merge: final security lan hardening release candidate`; `fa4704da fix(release): harden backup restore and lan deployment security`; `e6806f46 docs(manuals): add field validation checklist and cashier short guide`; `79c1609e Merge branch 'fix/pos-dialysis-permission-gate-2026-06-15' into main`; `3f001dc1 fix(pos): gate dialysis prescription control by permission` |
| `composer validate` | repo | NO INSTALADO | `composer : El termino 'composer' no se reconoce como nombre de un cmdlet... CommandNotFoundException` |
| `composer audit --no-interaction` | repo | NO INSTALADO | `composer : El termino 'composer' no se reconoce como nombre de un cmdlet... CommandNotFoundException` |
| `npm audit --audit-level=high` | `frontend` | FALLO | PowerShell intento cargar `C:\Program Files\nodejs\npm.ps1` y fallo por ExecutionPolicy. |
| `npm.cmd audit --audit-level=high` | `frontend` | FALLO | 8 vulnerabilities: 1 low, 1 moderate, 6 high. Altas en `@babel/core`, `esbuild`/`vite`, `form-data`, `ws`. |
| `npm.cmd run typecheck` | `frontend` | PASO | `tsc --noEmit` sin errores. |
| `npm.cmd run lint` | `frontend` | PASO | `eslint .` sin errores. |
| `npm.cmd run test` | `frontend` | PASO | 66 test files passed, 290 tests passed. |
| `npm.cmd run build` | `frontend` | PASO | Vite build OK, 2757 modules transformed. |
| `npm.cmd run e2e` | `frontend` | FALLO | Migro y sembro entorno E2E, luego fallo: `The E2E seed password must be provided via --password or E2E_SEED_PASSWORD.` |
| `php artisan test --colors=never` | `backend` | PASO | 556 passed, 11 skipped, 3586 assertions. |
| `vendor/bin/pint --test` | `backend` | PASO | `{"tool":"pint","result":"passed"}` |
| `vendor/bin/phpstan analyse` | `backend` | PASO | `[OK] No errors`, 194/194 files. |
| `php artisan config:cache --no-ansi` | `backend` | PASO | `Configuration cached successfully.` |
| `php artisan config:clear --no-ansi` | `backend` | PASO | `Configuration cache cleared successfully.` |

## 5. Resultado exacto de cada comando

Los comandos criticos actuales tienen este estado:

- Git rama/HEAD/log: PASO.
- Git status: PASO, pero muestra worktree sucio.
- Composer validate/audit: NO INSTALADO en este host.
- NPM audit: FALLO.
- Frontend typecheck/lint/test/build: PASO.
- Frontend E2E: FALLO por falta de `E2E_SEED_PASSWORD` o `--password`.
- Backend full test/Pint/PHPStan/config cache/config clear: PASO.

## 6. Contradicciones encontradas

1. `AGENTS.md` todavia definia el producto como emision de recibos termicos y exigia impresion termica 80mm/58mm como regla principal.
2. `docs/00_README.md` describia `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` como "the final handoff doc with `PRODUCTION_READY=YES`", aunque el estado actual documentado y probado no es production ready.
3. Documentos historicos siguen mencionando fases hacia `PRODUCTION_READY`, impresoras termicas o validacion de cinco formatos. No todos son contradicciones activas: muchos son historicos, planes o negaciones explicitas de `PRODUCTION_READY`.
4. Reportes previos de F7 dicen que `npm run e2e` pasaba. En el HEAD/worktree actual, `npm.cmd run e2e` falla por password de seed E2E requerido.
5. Reportes previos mencionan Composer no disponible en PATH. Eso sigue siendo verdad en este host.
6. Reportes previos mencionan `phpstan` no instalado como historico. En el estado actual de `backend/vendor`, `vendor/bin/phpstan analyse` existe y PASA.

## 7. Contradicciones corregidas

1. `AGENTS.md` actualizado:
   - Recibo principal institucional PDF/papel.
   - Formatos carta, media carta o A5.
   - 80mm/58mm solo compatibilidad secundaria.
   - Sin QR, codigo de barras ni codigos internos en recibo principal.
2. `docs/00_README.md` actualizado:
   - Ya no afirma que el handoff vigente tenga `PRODUCTION_READY=YES`.
   - Declara `PRODUCTION_READY=NO` hasta completar evidencia final de LAN, impresora, restore, concurrencia, backup worker, production env y paquete offline.
3. `reports/CURRENT_RELEASE_TRUTH.md` creado como fuente de verdad actual basada en comandos del HEAD/worktree actual.

## 8. Estado real actual

Estado unico actual: `NOT_READY`.

Motivo:

- No se puede declarar `PRODUCTION_READY`: faltan evidencias fisicas/finales requeridas.
- No se puede declarar `PRODUCTION_CANDIDATE` limpio: `npm audit` vigente sigue pendiente/fallido, `npm run e2e` host falla por preflight de dependencias Composer locales y el worktree esta sucio.
- No se puede declarar `READY_FOR_REAL_LAN_OFFLINE_INSTALLATION_TEST` vigente: ese estado requiere gates actuales cerrados; el E2E actual falla.
- El nucleo funcional tiene evidencia fuerte por backend full test, frontend tests, build, Pint y PHPStan pasando, pero el release actual no esta cerrado.

## 9. Bloqueantes actuales

1. Worktree sucio con cambios no cerrados y archivos no rastreados.
2. `npm.cmd audit --audit-level=high` falla con 6 vulnerabilidades altas.
3. `npm.cmd run e2e` host requiere `backend/vendor/autoload.php`; el preflight indica correr `composer install` en `backend/` antes de ese gate.
4. Falta prueba desde segunda PC LAN.
5. Falta impresora fisica institucional.
6. Falta restore final en servidor/base descartable final.
7. Falta worker continuo de backups validado en servidor final.
8. Falta configuracion production real (`APP_ENV=production`, `APP_DEBUG=false`, dominios/IP LAN reales, herramientas MySQL dump).
9. Falta admin real creado sin seeders de validacion.
10. Falta paquete offline regenerado desde el commit final.
11. Falta guard de release limpio sobre ese paquete final.

## 10. Pendientes no bloqueantes

1. Modulos clinicos completos: medicos, citas, consultas, historial clinico, laboratorio clinico, farmacia/inventario, habitaciones, admisiones y emergencias. Son futuro/no bloqueante si no se prometen.
2. Optimizacion fina de bundles frontend para PCs modestas.
3. Dashboard de salud/observabilidad mas profundo.
4. Limpieza de documentos historicos antiguos que mencionan 80mm/58mm o `PRODUCTION_READY` como planes pasados, siempre que no sean fuente normativa vigente.

## 11. Que se puede presentar

Se puede presentar una demo tecnica controlada del nucleo:

- Login local.
- Roles/permisos.
- Caja.
- Facturacion.
- Regla de eritropoyetina.
- Pagos.
- Recibo institucional PDF/papel.
- Historial/reimpresion.
- Reportes.
- Backups como flujo probado por tests.

La presentacion debe aclarar que el release actual esta `NOT_READY` para entrega final hasta corregir bloqueantes de audit/E2E/Composer/worktree y evidencias fisicas.

## 12. Que NO se debe prometer

No prometer:

- `PRODUCTION_READY`.
- Validacion clinica u operativa formal.
- Segunda PC LAN validada.
- Impresora fisica validada.
- Restore final validado en el servidor/base final.
- Worker continuo de backups instalado y funcionando en servidor final.
- Paquete offline final regenerado y limpio desde commit final.
- Modulos clinicos completos.
- Que `npm audit` esta limpio.
- Que `composer audit` fue ejecutado en este host; la evidencia vigente es containerizada.

## 13. Proximo paso exacto para llegar a PRODUCTION_READY

Orden recomendado:

1. Cerrar el E2E host: instalar dependencias Composer locales en `backend/` (`composer install`) o definir un runner host soportado equivalente; repetir `npm.cmd run e2e`.
2. Resolver `npm.cmd audit --audit-level=high` con actualizacion de dependencias o excepcion documentada y aprobada si aplica solo a tooling no productivo.
3. Revisar el worktree sucio, separar cambios por fase, ejecutar gates y commitear.
4. Regenerar paquete offline desde el commit final.
5. Ejecutar guard de release limpio.
6. En servidor final: configurar production real, admin real y worker continuo de backups.
7. Ejecutar y documentar segunda PC LAN, impresora fisica, restore final y concurrencia final.
8. Ejecutar `scripts/final_production_handoff.ps1` sin bypass y sin evidencia faltante.

Solo despues de esos pasos se puede evaluar `PRODUCTION_READY`.
