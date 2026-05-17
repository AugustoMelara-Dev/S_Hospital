# Release readiness - Fase 9

Fecha: 2026-05-17
Alcance: demo vendible y revision final de entrega.

## Estado

Estado general: LISTO PARA DEMO CONTROLADA; NO PRODUCTION-READY hasta cerrar E2E Playwright y validaciones de entorno pendientes.

La demo vendible puede cubrir login, caja, factura, regla de eritropoyetina, cobro, recibo termico, historial, reimpresion, anulacion sin pagos, reportes y backup local. Los pendientes de entorno quedan documentados como limitaciones y no se presentan como validados.

## Evidencia QA ejecutada

Resultado local:

- `composer validate`: OK.
- `php artisan migrate:fresh --seed`: OK solo en entorno local descartable previo; no es comando seguro de produccion.
- `php artisan test --colors=never`: OK, 101 tests / 526 assertions.
- `vendor/bin/pint --test`: OK.
- `php artisan config:cache --no-ansi`: OK; el gate seguro limpia cache despues de verificarla para evitar estado persistente en desarrollo.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK.
- `npm.cmd run test`: OK, 18 tests.
- `npm.cmd run build`: OK.
- `bash scripts/quality_gate.sh`: el `bash` por defecto de Windows apunta a WSL y fallo porque no hay distro instalada.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/quality_gate.sh`: OK como gate seguro/no destructivo. `phpstan` no esta instalado y no forma parte del gate requerido actual.
- `C:\Program Files\Git\usr\bin\bash.exe scripts/quality_gate_destructive.sh` sin variable explicita: aborta antes de reset.
- `HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1` con `DB_DATABASE=hospital_billing`: aborta porque la base no parece descartable.
- Playwright/E2E: pendiente. No se afirma que E2E Playwright paso. La fase no puede declararse production-ready hasta correr al menos un smoke de login/navegacion y el flujo E2E acordado.

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

cd ..
bash scripts/quality_gate.sh
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

- Restore real: `PENDING_ENVIRONMENT_VALIDATION` hasta ejecutar con MySQL/MariaDB real o Docker.
- Impresora fisica termica: pendiente hasta probar equipo 80mm/58mm.
- Concurrencia real MySQL/MariaDB: pendiente antes de produccion final.
