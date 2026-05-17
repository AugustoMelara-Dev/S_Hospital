# Release checklist - demo vendible

## Quality gate local

- `composer validate`
- `php artisan migrate:fresh --seed`
- `php artisan test --colors=never`
- `vendor/bin/pint --test`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- `bash scripts/quality_gate.sh` si Bash esta disponible en el entorno.

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
