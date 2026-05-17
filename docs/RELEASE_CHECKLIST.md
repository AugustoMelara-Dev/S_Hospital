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
