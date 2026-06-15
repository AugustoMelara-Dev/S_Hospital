# Hospital San Isidro - Hardening field readiness

Fecha: 2026-05-31
Rama: `codex/hospital-san-isidro-hardening-field`
Base preservada: `a3e95d4 test(release): verify hospital san isidro rc gate`

## Estado

LISTO para commit local de hardening de campo. No se hizo push.

## Capturas generadas

- Matriz visual light/dark desktop/medio: `qa/screenshots/hardening-field-visual-matrix/`
- Total PNG matriz visual: 44
- Reporte de matriz: `qa/screenshots/hardening-field-visual-matrix/field-qa-fixed-report.json`
- Resultado matriz: `failing: []`
- Smoke operacional con factura, cobro, recibo, historial, reportes, respaldos y fiscal: `qa/screenshots/phase-12-visual-smoke/`
- Resultado smoke operacional: `blockerCount: 0`

## Pantallas auditadas

- Login
- Dashboard
- Ayuda
- Nueva factura
- Caja
- Catalogo
- Historial
- Reportes
- Respaldos
- Configuracion fiscal
- Recibo institucional

## Cambios principales

- QA visual ahora captura light/dark en desktop y tamano medio.
- Smoke operacional abre caja de forma autenticada, emite factura, registra pago, valida recibo, historial, reportes, backups y configuracion fiscal.
- Seeder de roles/permisos limpia explicitamente la cache real de Spatie para evitar permisos obsoletos en local/testing.
- Tests de permisos refrescan usuarios con roles y limpian cache entre pruebas.
- Instalador Windows deja de usar `migrate:fresh --seed --force`; ahora corre migraciones seguras y seeders base sin crear usuarios demo en produccion.
- `.env.example` y `.env.docker.example` usan identidad Hospital San Isidro y zona horaria de Honduras.
- Manual legado se simplifica con lenguaje institucional, restore seguro y sin marca `S_Hospital OS`.

## Validacion MySQL/MariaDB

- Backup manual creado: `hospital-backup-20260530-223355-j2lk0swa.sql`
- Restore probado en base descartable: `hospital_restore_validation_codex`
- Conteos restaurados: `migrations=32 users=3 services=122 backup_logs=1`
- Base descartable eliminada despues de validar.
- Base local reparada despues de pruebas mal aisladas usando solo migraciones no destructivas y seeders idempotentes de entorno local.

## Tests ejecutados

- `git status`
- `npm.cmd run check:branding`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- `docker compose exec -e APP_ENV=testing -e CACHE_STORE=array -e SESSION_DRIVER=array -e QUEUE_CONNECTION=sync -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never`
- `npm.cmd run e2e`
- `docker compose ps`
- `node qa/visual-smoke/phase-12-visual-smoke.mjs`
- `node qa/visual-smoke/field-qa-current-screenshots.mjs`

## Resultados

- Frontend unit: 37 tests passed.
- Backend: 171 tests passed, 1046 assertions.
- E2E: 2 tests passed.
- Branding: sin hallazgos.
- Docker: backend, frontend y MariaDB activos; MariaDB healthy.

## Riesgos pendientes

- Validacion fisica real de impresora, LAN cliente independiente, reinicio Windows y UPS sigue siendo actividad de campo.
- El servidor final debe crear admin real con `auth:create-initial-admin`; no usar usuarios demo.
- Repetir restore en el equipo final si cambian rutas, dump tool o base real.
