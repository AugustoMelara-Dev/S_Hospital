# Preparacion de entrega RC - S_Hospital

Fecha: 2026-05-18
Alcance: preparacion local del producto institucional, con evidencia de QA real y limites de produccion final.

## Estado

Estado general: PRODUCTION_CANDIDATE; NO PRODUCTION_READY hasta cerrar validacion completa desde cliente LAN fisico, impresora institucional fisica, restore/concurrencia final, worker continuo de backups y configuracion final de produccion con admin real.

La preparacion local cubre login, caja, factura, regla de eritropoyetina, scanner/codigos, cobro, recibo institucional, historial, reimpresion, anulacion sin pagos, reportes avanzados y backup local. El cierre conserva evidencia de restore, concurrencia y rutas LAN. Los pendientes de hardware/entorno quedan documentados como limitaciones y no se presentan como validados.

## Definiciones de estado

- LOCAL_VALIDATION_READY: flujo operativo validado en ambiente local/controlado.
- PRODUCTION_CANDIDATE: codigo, gates seguros, E2E local y runbooks/scripts de validacion real estan listos, pero faltan pruebas en servidor/hardware final.
- PRODUCTION_READY: restore real, concurrencia real MySQL/MariaDB, LAN desde cliente fisico, impresora institucional real media carta/carta/A5, worker continuo de backups, paquete offline limpio del commit final y configuracion production final fueron ejecutados y documentados.

## Evidencia QA ejecutada

Resultado Fase 12:

- `php artisan test --colors=never`: OK, 124 tests / 724 assertions.
- `php artisan config:cache`: OK.
- `npm.cmd run test`: OK, 20 tests.
- `npm.cmd run lint`: OK.
- `npm.cmd run build`: OK.
- `npm.cmd run smoke:real` con `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`: OK para el smoke real no destructivo.
- `npm.cmd run smoke:real` mantiene el flujo mutacional apagado por defecto; para crear/cobrar factura real exige `E2E_REAL_ALLOW_MUTATIONS=1` y snapshot/backup previo.
- Navegacion real validada en Vite/Laravel local: login, dashboard y `/billing/new` cargan sin volver a login, sin `Sesion vencida`, sin errores de consola y sin requests fallidas inesperadas.

Cobertura Fase 12 cerrada:

- AppShell profesional con sidebar, topbar, caja, usuario, hora local y estado LAN.
- POS con categorias, busqueda, scanner/codigo, carrito lateral, confirmacion, caja obligatoria y recibo institucional media carta/carta/A5.
- Catalogo con tabla compartida, filtros, estado activo/inactivo y `scan_code`, `barcode`, `qr_code`.
- Reportes gerenciales con KPIs, filtros, servicios mas vendidos, auditoria operativa, backups y exportacion autorizada.
- QA separado entre E2E mockeado, smoke real no destructivo y smoke mutacional opt-in.

Resultado local:

- `composer validate`: OK.
- `composer audit`: OK, sin advisories conocidos despues de actualizar parches Symfony/Guzzle compatibles.
- `php artisan migrate:fresh --seed`: OK solo en entorno local descartable previo; no es comando seguro de produccion.
- `php artisan test --colors=never`: OK, 103 tests / 537 assertions.
- `vendor/bin/pint --test`: OK.
- `php artisan config:cache --no-ansi`: OK; el gate seguro limpia cache despues de verificarla para evitar estado persistente en desarrollo.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK.
- `npm.cmd run test`: OK, 18 tests.
- `npm.cmd run build`: OK.
- `npm.cmd run e2e`: OK, 1 Playwright test / flujo cajero-admin con login, caja, factura, eritropoyetina normal y gratis, pago, recibo institucional, historial, reimpresion, reportes y backup pending. Usa API mockeada local/testing; no toca produccion.
- `bash scripts/quality_gate.sh`: el `bash` por defecto de Windows apunta a WSL y fallo porque no hay distro instalada.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/quality_gate.sh`: OK como gate seguro/no destructivo. `phpstan` no esta instalado y no forma parte del gate requerido actual.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/e2e_gate.sh`: OK; usa wrapper PowerShell controlado para arrancar Vite, ejecutar Playwright y detener el servidor.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/quality_gate_destructive.sh` sin variable explicita: aborta antes de reset.
- `HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1` con `DB_DATABASE=hospital_billing`: aborta porque la base no parece descartable.
- `scripts/validate_restore_mysql.sh`: destructivo solo contra `RESTORE_TEST_DATABASE` descartable, con confirmacion exacta `HOSPITAL_CONFIRM_RESTORE_DATABASE`.
- `scripts/validate_mysql_concurrency.sh`: mutante solo contra target descartable confirmado; crea datos con `RUN_ID` y requiere snapshot previo porque no borra facturas auditables.
- Playwright/E2E local: cerrado para el flujo minimo de Fase 10. No reemplaza pruebas contra MySQL/MariaDB real ni hardware.

Busqueda local de secretos/dependencias cloud:

- No se encontraron secretos reales commiteados en frontend ni codigo de aplicacion.
- Las referencias a AWS/S3/Slack detectadas pertenecen a configuracion base opcional de Laravel/vendor lock, no a una dependencia operativa obligatoria.
- Credenciales temporales de validacion existen solo en `local`/`testing` y estan cubiertas por test ampliado. No entregar servidor LAN real con `APP_ENV=local`.

Comandos a ejecutar para cierre local:

```powershell
cd backend
composer validate
php artisan test --colors=never
vendor/bin/pint --test
php artisan config:cache --no-ansi
php artisan config:clear --no-ansi

cd ..\frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run e2e

cd ..
bash scripts/quality_gate.sh
bash scripts/e2e_gate.sh
```

Reset destructivo solo para base descartable:

```powershell
cd C:\Projects\S_Hospital
$env:HOSPITAL_ALLOW_DESTRUCTIVE_RESET = "1"
& "C:\Program Files\Git\usr\bin\bash.exe" scripts/quality_gate_destructive.sh
```

El script destructivo aborta salvo `APP_ENV=local/testing`, variable explicita y base con nombre descartable (`test`, `local` o equivalente controlado) o SQLite en testing.

## Validacion produccion sin reset

En servidor real del hospital:

- Regenerar `offline-release` desde el commit que se entregara si hubo commits posteriores al ultimo paquete validado.
- Ejecutar `scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit` y guardar la salida en evidencia de soporte.
- No ejecutar `php artisan migrate:fresh --seed`.
- No ejecutar seeders de validacion local ni entregar usuarios temporales activos.
- Mantener `.env` production fuera de Git.
- Usar `APP_ENV=production`.
- Usar `APP_DEBUG=false`.
- Configurar `APP_URL`, CORS y `SANCTUM_STATEFUL_DOMAINS` con la IP fija o dominio LAN real.
- Crear admin real con el instalador o `php artisan auth:create-initial-admin` usando `HOSPITAL_INITIAL_ADMIN_PASSWORD`; no pasar la contrasena como argumento CLI.
- Ejecutar `php artisan config:cache --no-ansi`.
- Levantar worker de backups como servicio/tarea continua y validar backup manual `pending` -> `success`.
- Probar restore real en base descartable, no en la base activa.
- Probar desde segunda PC en LAN.
- Probar impresora institucional fisica con media carta/carta/A5.
- Ejecutar pruebas solo contra entorno de testing aislado.
- Validar manualmente `/up`, `/login`, `/verify-email`, caja, factura, cobro, impresion y backup sin borrar datos.
- Si se sirve same-origin desde Laravel, ejecutar `npm.cmd run build` antes de publicar y confirmar que `/login` y `/verify-email` devuelven el build React.

El guard de release debe fallar si el paquete contiene `.env`, logs,
respaldos SQL, `node_modules`, evidencia QA local o un manifiesto que indique
que las imagenes deben regenerarse.

## Evidencia de artefacto offline

El paquete `offline-release` fue regenerado localmente con `scripts\make_offline_release.ps1 -Force` y el guard `scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit` paso con `OFFLINE_RELEASE_CLEAN: YES`.

Esta evidencia solo es vigente para el HEAD usado al generar el paquete. Si se crea otro commit, el paquete debe regenerarse y el guard debe volver a pasar antes de entrega.

## Analisis estatico

`phpstan` no esta instalado en esta fase y queda fuera del gate requerido actual. No se presenta como ejecutado. Debe agregarse en una fase futura si se decide convertirlo en obligatorio.

## Revision de alcance

- No se agregaron modulos clinicos.
- No se agrego inventario.
- No se agrego dashboard complejo.
- No se agrego cloud sync.
- No se agrego restore UI.
- No se agrego PDF avanzado.
- Paciente sigue siendo solo nombre en factura.

## Seguridad y offline LAN

- Las rutas operativas estan bajo autenticacion, usuario activo y cambio de password completado.
- Permisos sensibles se validan en backend.
- Usuarios temporales de validacion se crean solo en `local` o `testing`.
- Produccion offline LAN debe usar `APP_ENV=production`, `APP_DEBUG=false`, `config:cache` y admin real creado sin seeders de validacion local.
- No hay dependencia cloud obligatoria para operacion.
- Backups son locales.

## Evidencia Fase 11

- Restore real MySQL/MariaDB: VALIDATED en `hospital_restore_validation_test` usando `scripts/validate_restore_mysql.sh`, backup `hospital-backup-20260517-204322-lcsexyiz.sql`, SHA256 `5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362`.
- Conteos restore: users 3, roles 3, permissions 27, services 122, invoices 1, payments 1, cash_register_sessions 1, backup_logs 5.
- Concurrencia real MySQL/MariaDB local: VALIDATED con `scripts/validate_mysql_concurrency.sh`, `RUN_ID=concurrency-validation-20260517T20435`, doble apertura 201/422, facturas concurrentes `000-001-01-00000002` y `000-001-01-00000003`, doble pago 201/422.
- LAN por IP desde servidor: `/up`, `/login`, `/verify-email` y asset JS respondieron 200 en `http://192.168.1.7:8000`.
- Worker backups: `POST /api/backups` creo `pending`; `php artisan queue:work --queue=backups --tries=1 --timeout=600 --once` proceso el job. Sin dump en PATH fallo controlado; con PATH de XAMPP el backup de restore fue `success`.
- Reportes nuevos: `qa/FIELD_DEPLOYMENT_VALIDATION.md` y `qa/PRODUCTION_READINESS_GAP_REPORT.md`.

## Pendientes honestos

- Restore real: VALIDATED en entorno local con MariaDB XAMPP y base descartable. Repetir en servidor final antes de entregar produccion si el hardware/rutas cambian.
- Concurrencia real MySQL/MariaDB: VALIDATED en entorno local mutante con snapshot/backup previo. Repetir en servidor final o base descartable final antes de entregar produccion.
- Impresora fisica institucional: `PENDING_HARDWARE_VALIDATION` hasta probar media carta/carta/A5 en la PC de caja.
- LAN fisica: `PENDING_LAN_CLIENT_VALIDATION` hasta validar checklist completo desde otra computadora cliente por IP fija/nombre servidor.
- Produccion final: `PENDING_ENVIRONMENT_VALIDATION` hasta configurar `APP_ENV=production`, `APP_DEBUG=false`, admin real, worker continuo de backups, sin seeders de validacion local y `config:cache` en servidor final. El artefacto offline debe estar regenerado desde el commit final y con guard limpio al momento de entrega.

## Evidencia Fase 10

- Rutas web reales: `/`, `/login` y `/verify-email` sirven `frontend/dist/index.html` desde Laravel cuando existe build; `/assets/*` sirve assets del build con `nosniff`.
- Test backend: `ProductionSpaRouteTest` valida `/`, `/login`, `/verify-email`, assets del build y bloqueo de path traversal.
- Gate E2E: `frontend/e2e/production-readiness.spec.ts` cubre flujo cajero-admin sin tocar base real.
- Restore MySQL real: script creado; al ejecutarlo con `HOSPITAL_VALIDATE_RESTORE_MYSQL=1` en esta maquina aborta porque falta cliente `mysql`, por lo que sigue pendiente de entorno.
- Concurrencia MySQL real: script HTTP creado; al ejecutarlo con `HOSPITAL_VALIDATE_REAL_MYSQL=1` en esta maquina falla por no tener servidor Laravel/MySQL de validacion corriendo, por lo que sigue pendiente de entorno.
