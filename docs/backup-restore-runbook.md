# Runbook de backup y restauracion

Procedimiento operativo para respaldos locales y restauracion manual en el
servidor LAN del hospital.

## 1. Alcance

- Los respaldos se crean desde la app, desde `hospital:backup` o por el
  scheduler local.
- La restauracion no existe en la UI ni en la API. Cualquier restore se hace
  desde el servidor por personal autorizado.
- Los respaldos quedan registrados en `backup_logs` con nombre, estado,
  tamano, SHA-256, tipo y usuario solicitante cuando aplica.
- El archivo cifrado se guarda en el disco `local` de Laravel:
  `backend/storage/app/private/backups/`.
- Los respaldos nuevos son `.sql.gz.enc`: SQL comprimido con gzip y cifrado
  con `HOSPITAL_BACKUP_ENCRYPTION_KEY`. Los respaldos legacy creados antes de
  esta regla pueden requerir el `APP_KEY` historico para descifrarse.

## 2. Crear un respaldo

### Desde la app

1. Iniciar sesion con un usuario que tenga `backups.create`.
2. Abrir `/backups`.
3. Presionar **Crear respaldo** y confirmar.
4. Esperar a que el worker procese el job y el registro cambie a `success`.
5. Confirmar que `size_bytes > 0` y `checksum_sha256` no este vacio.

### Desde el servidor

Con Docker:

```bash
docker compose exec backend php artisan hospital:backup --type=manual
```

En una instalacion local sin Docker:

```bash
cd /var/www/s_hospital/backend
php artisan hospital:backup --type=manual
```

El comando acepta solo `manual` o `scheduled`.

## 3. Backup automatico

El scheduler ejecuta:

- `hospital:backup --type=scheduled` diariamente a
  `HOSPITAL_DAILY_BACKUP_TIME` o `02:00`.
- `hospital:backup --type=scheduled` cada 15 minutos durante
  `HOSPITAL_OPERATION_START` a `HOSPITAL_OPERATION_END`.

El servidor debe tener activo el scheduler y el worker de cola. Si el panel de
`/backups` muestra jobs pendientes por mucho tiempo, revisar primero el worker.

## 4. Descargar un respaldo

Solo usuarios con `backups.download` pueden descargar respaldos exitosos.

1. En `/backups`, seleccionar el respaldo `success`.
2. Presionar el icono de descarga.
3. Verificar que el archivo descargado conserve el nombre
   `hospital-backup-YYYYMMDD-HHMMSS-xxxxxxxx.sql.gz.enc`.
4. Calcular SHA-256 localmente y compararlo con el valor registrado.

Windows PowerShell:

```powershell
Get-FileHash C:\backups\hospital-backup.sql.gz.enc -Algorithm SHA256
```

Linux:

```bash
sha256sum /backups/hospital-backup.sql.gz.enc
```

## 5. Restauracion: regla principal

No restaurar directamente sobre produccion. Primero se restaura en una base
descartable y se validan conteos, facturas, pagos, caja y auditoria.

Antes de cualquier restore:

1. Obtener autorizacion escrita del responsable operativo.
2. Detener temporalmente uso de caja/facturacion.
3. Crear un respaldo nuevo del estado actual.
4. Verificar espacio libre: minimo 2x el tamano del respaldo a restaurar.
5. Verificar SHA-256 del archivo `.sql.gz.enc`.
6. Confirmar que se conserva `HOSPITAL_BACKUP_ENCRYPTION_KEY` del servidor que creo el backup.

## 6. Restore de prueba en Windows

Usar el script incluido cuando el servidor sea Windows o tenga cliente MySQL
compatible:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 `
  -UseExistingEnv `
  -TargetDatabase hospital_restore_validation `
  -BackupFile C:\backups\hospital-backup.sql.gz.enc `
  -ExpectedSha256 <sha256>
```

Notas:

- `TargetDatabase` debe ser descartable y contener `test`, `restore`,
  `validation`, `disposable` o `proof`.
- El script rechaza bases productivas incluso si alguien intenta forzar el restore; produccion se restaura solo con el runbook manual y parada operativa.
- Para backups `.sql.gz.enc`, el script llama internamente a
  `php artisan hospital:decrypt-backup <input> <output>`.
- Para ensayo sin escribir datos, usar `-WhatIf`.

## 7. Restore de prueba manual

Descifrar el backup a un SQL temporal:

```bash
cd /var/www/s_hospital/backend
php artisan hospital:decrypt-backup \
  /backups/hospital-backup.sql.gz.enc \
  /tmp/hospital-backup-restore.sql
chmod 600 /tmp/hospital-backup-restore.sql
```

Crear base descartable y restaurar ahi:

```bash
mysql -u root -p -e "CREATE DATABASE hospital_restore_validation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p hospital_restore_validation < /tmp/hospital-backup-restore.sql
```

Validar:

- `invoices`, `invoice_items`, `payments` y `cash_register_sessions` tienen
  conteos esperados.
- La ultima factura pagada conserva paciente, cajero, caja, metodo de pago y
  fecha.
- Los correlativos fiscales coinciden con la ultima factura emitida antes del
  respaldo.
- `backup_logs` y `audit_logs` estan presentes.
- El sistema puede levantar apuntando temporalmente a la base restaurada.

Eliminar el SQL temporal al finalizar:

```bash
shred -u /tmp/hospital-backup-restore.sql 2>/dev/null || rm -f /tmp/hospital-backup-restore.sql
```

## 8. Restore sobre produccion

Solo proceder si el restore de prueba fue exitoso y existe autorizacion
escrita.

1. Poner la app en mantenimiento:

   ```bash
   php artisan down
   ```

2. Crear dump final del estado actual antes de sobrescribir:

   ```bash
   mysqldump -u root -p s_hospital | gzip > /tmp/pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz
   ```

3. Restaurar el SQL validado:

   ```bash
   mysql -u root -p s_hospital < /tmp/hospital-backup-restore.sql
   ```

4. Ejecutar validaciones minimas:

   ```bash
   php artisan migrate:status
   php artisan test --filter=BackupWorkflowTest
   ```

5. Levantar la app:

   ```bash
   php artisan up
   ```

6. Registrar manualmente en la bitacora operativa:
   - fecha y hora;
   - responsable;
   - motivo;
   - SHA-256 restaurado;
   - base de prueba usada;
   - resultado de validaciones.

## 9. Criterios de exito

- Backup: registro `success`, archivo existente, `size_bytes > 0`,
  `checksum_sha256` calculado y descarga verificada.
- Restore de prueba: base descartable restaurada, conteos criticos correctos y
  app funcional contra esa base.
- Restore productivo: app vuelve a operar, facturas/caja/reportes abren, y la
  bitacora operativa contiene evidencia del procedimiento.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Restaurar sobre datos mas recientes | Modo mantenimiento, autorizacion escrita y dump pre-restore obligatorio. |
| Clave de backup perdida o cambiada | Sin `HOSPITAL_BACKUP_ENCRYPTION_KEY` no se puede descifrar el `.sql.gz.enc`; respaldar la clave fuera del repositorio. Backups legacy pueden requerir el `APP_KEY` historico. |
| Correlativo fiscal duplicado | Validar ultima factura y correlativos en base descartable antes de tocar produccion. |
| Disco lleno | Verificar espacio libre antes de descifrar y restaurar. |
| SQL temporal expuesto | Crear con permisos restrictivos, usar ruta temporal local y eliminarlo al terminar. |
