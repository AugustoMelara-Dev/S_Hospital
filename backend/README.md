# API de S_Hospital

Backend Laravel del sistema hospitalario offline/LAN. La guia de instalacion, produccion y comandos completos esta en el [README principal](../README.md).

## Responsabilidades

- Autenticacion local con Sanctum, roles, permisos y cambio obligatorio de clave.
- Facturacion, snapshots de items, reglas fiscales y eritropoyetina.
- Pagos, caja, reversos, anulaciones y conciliacion transaccional.
- Recibos institucionales PDF, correlativos y eventos de impresion auditados.
- Reportes, exportaciones y respaldos cifrados.

## Comandos en Docker

```powershell
docker compose exec backend php artisan migrate --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
```

## Seed de produccion

En `APP_ENV=production`, `DatabaseSeeder` carga solamente datos base reproducibles: roles/permisos, perfiles de papel institucional, serie de recibos y catalogo. Las cuentas `*.validacion` se limitan a `local/testing`.

El administrador de produccion no tiene contraseña predeterminada. Se crea con `php artisan auth:create-initial-admin` y la clave temporal debe llegar por `HOSPITAL_INITIAL_ADMIN_PASSWORD`; el primer login exige cambiarla.

## Reglas de contribucion

- Controllers delgados; validacion en Form Requests y autorizacion en Policies/Gates.
- Facturas, pagos, cierres, anulaciones y correlativos dentro de transacciones.
- Dinero sin `float`; no recalcular facturas historicas desde el catalogo.
- No borrar facturas ni modificar/eliminar auditoria por Eloquent.
- Agregar Feature tests para endpoints y Unit tests para reglas de dominio.
