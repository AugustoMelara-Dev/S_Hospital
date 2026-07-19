# Actualizacion y rollback seguro

Este procedimiento preserva facturas, pagos, recibos y auditoria. Nunca usar
`migrate:fresh`, borrar volumentes Docker ni restaurar sobre la base activa sin
una copia verificada.

## Antes de actualizar

1. Detener nuevas operaciones y cerrar la caja activa desde la aplicacion.
2. Crear un backup manual y esperar estado `success`.
3. Verificar archivo, tamano, SHA-256 y descifrado en una base descartable con
   `scripts/restore_hospital_windows.ps1` o el runbook de backups.
4. Registrar commit/tag actual, imagenes Docker, `.env` protegido y conteos de
   `users`, `invoices`, `payments`, `institutional_receipts` y `audit_logs`.
5. Copiar fuera del directorio de despliegue el backup cifrado y los artefactos
   de la version anterior.

## Despliegue

1. Instalar el paquete offline aprobado; no descargar dependencias en
   produccion.
2. Conservar el `.env` real. Confirmar claves `APP_KEY`, base de datos y
   `HOSPITAL_BACKUP_ENCRYPTION_KEY` antes de iniciar.
3. Ejecutar `php artisan migrate --force`; nunca `migrate:fresh`.
4. Limpiar/recrear cache de configuracion y arrancar backend, frontend, MySQL,
   worker `backups`, worker `default` y scheduler.
5. Ejecutar `scripts/production_readiness_preflight.ps1` con la URL LAN final.
6. Validar login, factura, cobro, recibo, reimpresion, reporte y backup.

## Criterio de rollback

Hacer rollback si el healthcheck falla, una migracion no termina, los contratos
API incompatibles bloquean caja/facturacion o el smoke critico no pasa. Un fallo
de impresora se atiende primero restaurando driver/perfil; no justifica por si
solo restaurar la base.

## Rollback

1. Detener trafico y todos los workers para congelar escrituras.
2. Guardar un backup de diagnostico del estado fallido; no sobrescribir el
   backup preactualizacion.
3. Restaurar los artefactos/imagenes del commit anterior.
4. Si las migraciones fueron solo aditivas y el codigo anterior las tolera,
   conservar la base actual. No ejecutar `migrate:rollback` a ciegas.
5. Si existe incompatibilidad de esquema o datos, restaurar el backup
   preactualizacion en una base nueva, validar checksum y conteos, y cambiar la
   conexion solo despues de aprobarla. Conservar la base fallida para auditoria.
6. Arrancar servicios, ejecutar `/up`, login y smoke critico; documentar hora,
   operador, motivo, commit y checksums.

La restauracion implica perder operaciones posteriores al backup. Por eso el
periodo de mantenimiento debe impedir nuevas facturas desde el paso 1.
