# Release checklist - demo vendible

## Quality gate seguro

- `composer validate`
- `php artisan test --colors=never`
- `vendor/bin/pint --test`
- `php artisan config:cache --no-ansi`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- `bash scripts/quality_gate.sh` si Bash esta disponible en el entorno.

El quality gate normal es no destructivo. No ejecuta `php artisan migrate:fresh --seed` contra el `.env` activo.

## Gate E2E Fase 10

Playwright queda separado del gate seguro para que los fallos de navegador no se oculten dentro del build normal:

```bash
bash scripts/e2e_gate.sh
```

Equivalente Windows:

```powershell
cd C:\Projects\S_Hospital
& "C:\Program Files\Git\usr\bin\bash.exe" scripts/e2e_gate.sh
```

El E2E local usa ambiente seguro y API mockeada para cubrir login, caja, factura, eritropoyetina normal/gratis, pago, recibo 80mm/58mm, historial, reimpresion, reportes y backup pending. No valida MySQL/MariaDB real ni hardware.

## Reset dev/testing con base descartable

`php artisan migrate:fresh --seed` solo puede usarse para validar migraciones y seeders en una base descartable de desarrollo, testing o demo. No ejecutar `migrate:fresh` en el servidor real del hospital.

Usar el script destructivo solo si se cumplen todas las condiciones:

- `APP_ENV` es `local` o `testing`.
- `HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1`.
- `DB_DATABASE` contiene `test`, `demo` o `local`, o se usa `DB_CONNECTION=sqlite` en `testing`.

```bash
HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1 bash scripts/quality_gate_destructive.sh
```

## Validacion en servidor real sin reset

En produccion offline LAN no se borra la base. La validacion segura usa:

- `composer validate`
- `php artisan test --colors=never` si el servidor tiene entorno de testing aislado.
- `php artisan config:cache --no-ansi`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- Validaciones manuales de `/up`, `/login`, `/verify-email`, caja, factura, cobro, impresion y backup sin ejecutar reset.

No ejecutar `php artisan migrate:fresh --seed` en el servidor real del hospital.

## Validaciones reales antes de PRODUCTION_READY

Restore MySQL/MariaDB:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh
```

Este script es destructivo sobre `RESTORE_TEST_DATABASE`: hace `DROP DATABASE` y restaura el backup en esa base descartable. Nunca usarlo contra la base activa ni contra nombres sensibles. El nombre debe contener `test`, `restore`, `validation` o `disposable`.

Concurrencia MySQL/MariaDB por HTTP contra servidor de validacion:

```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONCURRENCY_BASE_URL=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=local HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://127.0.0.1:8000 HOSPITAL_ALLOW_DEMO_VALIDATION=1 bash scripts/validate_mysql_concurrency.sh
```

Este script es mutante: abre caja, crea facturas y registra pagos con un `RUN_ID`. No borra facturas porque son registros auditables; requiere snapshot/base descartable antes de ejecutarlo.

LAN fisica:

- Desde otra computadora cliente, abrir `http://IP_DEL_SERVIDOR/login`.
- Validar `/up`, `/login` y `/verify-email`.
- Confirmar que los clientes no usan `localhost`.
- Crear factura, cobrar, ver recibo y reporte desde navegador cliente.

## Analisis estatico opcional

`phpstan` no esta instalado en el backend actual y no forma parte del gate requerido de Fase 9. Si se instala en una fase futura, el gate debe declararlo como obligatorio y fallar cuando falte.

## Seguridad y permisos

- Verificar que `auth:sanctum`, `user.active` y `password.changed` protegen rutas operativas.
- Verificar que cajero no ve ni administra backups, reportes administrativos ni configuracion fiscal.
- Verificar que admin tiene acceso a configuracion fiscal, catalogo, caja, historial, reportes y backups.
- Verificar que `must_change_password=true` solo permite `me`, cambio de password y logout.
- Verificar que usuario inactivo no puede operar aunque exista sesion.
- Confirmar que no hay secretos reales en frontend ni repositorio.

## Demo operativa

- Login local.
- Abrir caja.
- Crear factura con nombre de paciente.
- Seleccionar servicios.
- Eritropoyetina normal L.25.
- Eritropoyetina con receta de dialisis L.0.
- Cobrar factura.
- Ver recibo 80mm y 58mm.
- Reimprimir desde historial.
- Anular factura sin pagos con motivo.
- Ver reportes.
- Crear backup local.

## Offline LAN

- Confirmar que login, facturacion, pagos, reportes e impresion no dependen de internet.
- Confirmar que produccion usa MySQL/MariaDB local.
- Confirmar que frontend compilado y backend se sirven desde la PC servidor por IP LAN.
- Confirmar `APP_ENV=production`, `APP_DEBUG=false` y `php artisan config:cache` antes de entregar servidor real.
- Confirmar que no se ejecutaron seeders demo en el servidor real.
- Confirmar worker local de backups:

```powershell
php artisan queue:work --queue=backups --tries=1 --timeout=600
```

## Antes de produccion final

- Probar restore real en MySQL/MariaDB o Docker.
- Probar impresora fisica termica 80mm/58mm.
- Validar concurrencia real con MySQL/MariaDB.
- Crear admin inicial real con password temporal y cambio obligatorio.
- Remover o no ejecutar seeders demo fuera de `local`/`testing`.
