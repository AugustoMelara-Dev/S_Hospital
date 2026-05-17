# Release readiness - Fase 10

Fecha: 2026-05-17
Alcance: production readiness, validaciones reales y cierre de bloqueantes.

## Estado

Estado general: PRODUCTION_CANDIDATE; NO PRODUCTION_READY hasta cerrar validaciones reales de restore MySQL/MariaDB, concurrencia MySQL/MariaDB, LAN desde cliente fisico y hardware de impresora termica.

La demo vendible puede cubrir login, caja, factura, regla de eritropoyetina, cobro, recibo termico, historial, reimpresion, anulacion sin pagos, reportes y backup local. Fase 10 agrego gate E2E Playwright, rutas LAN `/login` y `/verify-email` servidas por el build React desde Laravel, y scripts verificables para restore/concurrencia real. Los pendientes de entorno quedan documentados como limitaciones y no se presentan como validados.

## Definiciones de estado

- DEMO_READY: flujo vendible validado en ambiente local/controlado.
- PRODUCTION_CANDIDATE: codigo, gates seguros, E2E local y runbooks/scripts de validacion real estan listos, pero faltan pruebas en servidor/hardware final.
- PRODUCTION_READY: restore real, concurrencia real MySQL/MariaDB, LAN desde cliente fisico e impresora termica real fueron ejecutados y documentados.

## Evidencia QA ejecutada

Resultado local:

- `composer validate`: OK.
- `php artisan migrate:fresh --seed`: OK solo en entorno local descartable previo; no es comando seguro de produccion.
- `php artisan test --colors=never`: OK, 103 tests / 537 assertions.
- `vendor/bin/pint --test`: OK.
- `php artisan config:cache --no-ansi`: OK; el gate seguro limpia cache despues de verificarla para evitar estado persistente en desarrollo.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK.
- `npm.cmd run test`: OK, 18 tests.
- `npm.cmd run build`: OK.
- `npm.cmd run e2e`: OK, 1 Playwright test / flujo cajero-admin con login, caja, factura, eritropoyetina normal y gratis, pago, recibo 80mm/58mm, historial, reimpresion, reportes y backup pending. Usa API mockeada local/testing; no toca produccion.
- `bash scripts/quality_gate.sh`: el `bash` por defecto de Windows apunta a WSL y fallo porque no hay distro instalada.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/quality_gate.sh`: OK como gate seguro/no destructivo. `phpstan` no esta instalado y no forma parte del gate requerido actual.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/e2e_gate.sh`: OK; usa wrapper PowerShell controlado para arrancar Vite, ejecutar Playwright y detener el servidor.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/quality_gate_destructive.sh` sin variable explicita: aborta antes de reset.
- `HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1` con `DB_DATABASE=hospital_billing`: aborta porque la base no parece descartable.
- Playwright/E2E local: cerrado para el flujo minimo de Fase 10. No reemplaza pruebas contra MySQL/MariaDB real ni hardware.

Busqueda local de secretos/dependencias cloud:

- No se encontraron secretos reales commiteados en frontend ni codigo de aplicacion.
- Las referencias a AWS/S3/Slack detectadas pertenecen a configuracion base opcional de Laravel/vendor lock, no a una dependencia operativa obligatoria.
- Demo credentials existen solo en `local`/`testing` y estan cubiertas por test ampliado. No entregar servidor LAN real con `APP_ENV=local`.

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

El script destructivo aborta salvo `APP_ENV=local/testing`, variable explicita y base con nombre `test/demo/local` o SQLite en testing.

## Validacion produccion sin reset

En servidor real del hospital:

- No ejecutar `php artisan migrate:fresh --seed`.
- Usar `APP_ENV=production`.
- Usar `APP_DEBUG=false`.
- Ejecutar `php artisan config:cache --no-ansi`.
- Ejecutar pruebas solo contra entorno de testing aislado.
- Validar manualmente `/up`, `/login`, `/verify-email`, caja, factura, cobro, impresion y backup sin borrar datos.
- Si se sirve same-origin desde Laravel, ejecutar `npm.cmd run build` antes de publicar y confirmar que `/login` y `/verify-email` devuelven el build React.

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
- Demo users se crean solo en `local` o `testing`.
- Produccion offline LAN debe usar `APP_ENV=production`, `APP_DEBUG=false`, `config:cache` y admin real creado sin seeders demo.
- No hay dependencia cloud obligatoria para operacion.
- Backups son locales.

## Pendientes honestos

- Restore real: `PENDING_ENVIRONMENT_VALIDATION` hasta ejecutar `scripts/validate_restore_mysql.sh` con MySQL/MariaDB y `mariadb-dump` o `mysqldump`.
- Concurrencia real MySQL/MariaDB: `PENDING_ENVIRONMENT_VALIDATION` hasta ejecutar `scripts/validate_mysql_concurrency.sh` contra servidor Laravel conectado a una base MySQL/MariaDB descartable/preproduccion.
- Impresora fisica termica: `PENDING_HARDWARE_VALIDATION` hasta probar 80mm/58mm en la PC de caja.
- LAN fisica: `PENDING_ENVIRONMENT_VALIDATION` hasta validar desde otra computadora cliente por IP fija/nombre servidor.

## Evidencia Fase 10

- Rutas web reales: `/`, `/login` y `/verify-email` sirven `frontend/dist/index.html` desde Laravel cuando existe build; `/assets/*` sirve assets del build con `nosniff`.
- Test backend: `ProductionSpaRouteTest` valida `/login`, `/verify-email`, assets del build y bloqueo de path traversal.
- Gate E2E: `frontend/e2e/production-readiness.spec.ts` cubre flujo cajero-admin sin tocar base real.
- Restore MySQL real: script creado; al ejecutarlo con `HOSPITAL_VALIDATE_RESTORE_MYSQL=1` en esta maquina aborta porque falta cliente `mysql`, por lo que sigue pendiente de entorno.
- Concurrencia MySQL real: script HTTP creado; al ejecutarlo con `HOSPITAL_VALIDATE_REAL_MYSQL=1` en esta maquina falla por no tener servidor Laravel/MySQL de validacion corriendo, por lo que sigue pendiente de entorno.
