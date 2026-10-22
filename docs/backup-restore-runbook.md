# Runbook de backup y restauracion

Procedimiento operativo para respaldos locales y restauracion manual en el
servidor LAN del hospital.

## 1. Alcance

- Los respaldos se crean desde la app, desde `hospital:backup` o por el
  scheduler local.
- La restauracion no existe como accion destructiva en la UI ni en la API.
  La pagina orienta al acceso local **Mantenimiento S_Hospital**; el restore se
  ejecuta desde el servidor por personal autorizado.
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
- El modo predeterminado rechaza bases productivas. Para produccion solo se
  acepta el modo explicito `-ProductionRecovery`, con doble confirmacion,
  validacion descartable, respaldo preventivo y parada operativa.
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

1. Confirmar que todas las cajas esten cerradas y avisar la parada.
2. Calcular el SHA-256 del paquete cifrado.
3. Desde la computadora servidor, abrir **Mantenimiento S_Hospital** o ejecutar:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 `
     -ProductionRecovery `
     -BackupFile C:\backups\hospital-backup.sql.gz.enc `
     -ExpectedSha256 <sha256>
   ```

4. Escribir el nombre exacto de la base activa cuando el asistente lo solicite.
5. Escribir `RESTAURAR` para la segunda confirmacion.
6. Esperar el resultado final sin cerrar la ventana.

El asistente ejecuta en este orden:

1. Verifica SHA-256 y descifra el paquete en almacenamiento temporal.
2. Restaura y revisa diez tablas criticas en una base descartable.
3. Bloquea si existe una caja abierta.
4. Crea y verifica un respaldo preventivo de la base activa.
5. Activa mantenimiento y detiene los escritores.
6. Reemplaza la base, ejecuta migraciones y audita reglas institucionales.
7. Verifica salud, reinicia escritores y sale de mantenimiento.

### Fallo y rollback

Si ocurre un error despues de reemplazar la base:

- el asistente intenta restaurar automaticamente el respaldo preventivo;
- la aplicacion permanece en mantenimiento;
- no se debe reiniciar caja ni facturacion hasta que soporte confirme el estado;
- conservar el resultado visible y registrar si `rollback_succeeded` fue
  verdadero o falso.

### Evidencia operativa

Registrar fecha/hora, responsable, motivo, identificador relativo del respaldo,
coincidencia del SHA-256, conteos de validacion, resultado del respaldo
preventivo, migraciones, auditoria de catalogo, salud, rollback (si aplico),
estado final de mantenimiento y escritores. No incluir credenciales, clave de
cifrado ni rutas absolutas del servidor.

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

## 11. Copia externa cifrada (F019 / HS-BK-EXT)

Estado: **implementada y probada localmente; NO desplegada**. Sin un destino real
(USB/NAS/montaje/remoto) configurado y probado por el operador, el resultado
siempre declara `external_deployed=false` y no se anota ninguna copia como
protegida. Mientras siga desactivada, el respaldo y su copia viven en el mismo
servidor: sigue siendo un unico dominio de fallo.

Configuracion (`.env` del servidor; default `false`):

```env
HOSPITAL_BACKUP_EXTERNAL_ENABLED=false
HOSPITAL_BACKUP_EXTERNAL_DISK=backup_external
HOSPITAL_BACKUP_EXTERNAL_ROOT=
HOSPITAL_BACKUP_EXTERNAL_PATH=hospital-backups
HOSPITAL_BACKUP_EXTERNAL_LABEL=externo
HOSPITAL_BACKUP_EXTERNAL_VERIFY=true
```

Reglas del adaptador:

- Se copia el `.sql.gz.enc` local y se **relee el destino** calculando SHA-256 y
  tamano; la fila del ledger `backup_external_copies` pasa a `verified` solo si el
  hash del destino coincide con el del origen.
- Guard fail-closed: para driver `local` solo cuenta un root **absoluto, explicito
  y fuera** del storage y del arbol del proyecto. Root vacio, relativo, interno o
  que resuelva dentro por `..` (canonicalizado) falla sin escribir archivos ni
  filas y declara `external_configured=false`.
- Si el destino se degrada despues de verificar (root vaciado/roto), una
  re-verificacion pasa la fila a `failed` conservando `verified_at`/`sha256` como
  evidencia historica; no se finge una verificacion nueva.
- La activacion es explicita: deshabilitada no hay copia, ni filas, ni schedule.

Operacion:

```bash
php artisan hospital:backup-copy-external --latest --json
php artisan backup-copy-external <backup_logs.id> --json
```

Prueba de recuperacion (evidencia `hospital-ai/evidencia/M-W1-BK-01/`): un
respaldo sintetico se copia a un destino de laboratorio real en `%TEMP%`, se
borra el archivo local, se repone desde el destino externo, se re-verifica
(descifrado completo) y el dump se importa en una base limpia validando los
datos sinteticos.

## 12. Custodia de llaves (HS-BK-KEY)

Dos llaves distintas; no confundirlas:

| Llave | Uso | Consecuencia de perderla |
|---|---|---|
| `APP_KEY` | Tokens/sesiones/firmas; solo respaldos legacy | Backups legacy pueden quedar ilegibles |
| `HOSPITAL_BACKUP_ENCRYPTION_KEY` | Cifrado AES-256-GCM de los `.sql.gz.enc` nuevos | Los respaldos nuevos no se pueden descifrar |

Procedimiento de custodia:

1. Al instalar, registrar el **fingerprint** (nunca la llave) y custodiarlo fuera
   del servidor:

   ```bash
   php artisan hospital:backup-key-status --json
   ```

   El JSON reporta `fingerprint`, `latest_creation_key_matches` y
   `backups_with_other_key`; sirve para detectar una rotacion o perdida sin
   exponer material de la llave.
2. Guardar `HOSPITAL_BACKUP_ENCRYPTION_KEY` en un sobre/medio administrativo
   separado del servidor. Sin esa llave el `.sql.gz.enc` es irrecuperable.
3. **Actualizar/reinstalar no regenera las llaves existentes.** El instalador
   conserva `APP_KEY` y `HOSPITAL_BACKUP_ENCRYPTION_KEY` del `.env` existente y
   solo genera valor cuando la variable falta (`scripts/deploy_hospital_lan.ps1`,
   self-test "preserva HOSPITAL_BACKUP_ENCRYPTION_KEY existente").
4. Antes de cualquier actualizacion, crear y **verificar** un respaldo, anotar su
   fingerprint y confirmar que la llave custodiada corresponde.
5. Rotacion: respaldar la llave vigente y un respaldo verificado, generar la
   nueva llave, actualizar `.env`, `php artisan config:cache`, crear un respaldo
   nuevo con la llave nueva y repetir `hospital:backup-key-status`. Los respaldos
   antiguos requieren la llave con la que se crearon; no borrarlos hasta
   sustituirlos por copias verificadas con la llave nueva.
6. Si se pierde la llave, los respaldos afectados quedan `key_mismatch`: se
   detectan y no se declaran recuperables.

Escenarios probados (pruebas de backup): llave correcta, llave ausente, llave
equivocada (`key_mismatch` sin pisar `verified_at`), byte alterado, archivo
ausente, formato legacy y recuperacion desde copia externa.

## 13. Alertas locales y salud (HS-BK-ALERT)

```bash
php artisan hospital:check-backup-health --json
php artisan hospital:check-backup-health --fail-on-alert
```

Detecta respaldo atrasado **por creacion** (`stale_after_hours`, default 12),
fallos consecutivos (default 3), pendientes vencidos, ausencia de copia
recuperable (`recovery_unverified`), **atraso de la ultima copia verificada**
(`recovery_stale`, default `recoverable_stale_after_hours` = 26 h) y estado de la
copia externa. La alerta se registra de forma idempotente en `audit_logs`
(`backup.alert_raised`/`backup.alert_resolved`) y en la cache de alertas activas.

`recovery_stale` es una senal distinta de `backup_stale`: la verificacion de
recuperabilidad (`hospital:verify-backup --latest`) solo corre una vez al dia, asi
que la ultima copia **verificada** puede tener ~24 h aunque el ultimo respaldo se
haya creado hace minutos. El umbral se ajusta con
`HOSPITAL_BACKUP_ALERT_RECOVERABLE_STALE_HOURS` (default 26 h, por encima de la
cadencia diaria).

La **fuente de la senal es el estado persistente `backup_logs`**, no la cache:
tras un `cache:clear`, una nueva evaluacion vuelve a detectar el atraso y
`--fail-on-alert` sigue devolviendo exit 1 (regresion incluida). El canal externo
(email/webhook) es un contrato (`AlertChannel`) con `NullAlertChannel` por
defecto: **no hay canal externo desplegado ni verificado**.

## 14. RPO / RTO (HS-BK-RPO)

Se separan objetivo y observacion:

- **RPO planificado de creacion** (calculado de `backend/routes/console.php` y
  `backend/config/hospital.php`, no copiado de cifras historicas): respaldo diario
  a `HOSPITAL_DAILY_BACKUP_TIME` (02:00) + respaldo cada 15 min durante
  `HOSPITAL_OPERATION_START`-`HOSPITAL_OPERATION_END` (06:00-18:00). Peor hueco
  planificado: **8 h** (18:00 -> 02:00) con el scheduler activo; dentro de la
  ventana operativa, 15 min. La alerta `backup_stale` (12 h) supera este RPO.
- **RPO de recuperabilidad verificada**: un respaldo recien creado no es
  recuperable hasta que `hospital:verify-backup --latest` lo verifica
  (configurado **1 vez al dia**, 02:30). Por tanto la ultima copia *verificada*
  puede alcanzar estructuralmente **~24 h** de antiguedad. Este es el RPO que
  realmente limita el punto de recuperacion y **no** son las 8 h de creacion; la
  brecha se vigila con la alerta `recovery_stale` (default 26 h). Acortar el RPO
  de recuperabilidad exige aumentar la frecuencia de `verify-backup` (cambio de
  scheduler, fuera de esta entrega).
- **RPO observado**: edad de la ultima copia recuperable verificada. Ya se expone
  (`last_recoverable_at`, `age_seconds` en estado/health) y es el valor a vigilar
  en operacion; requiere que el sistema lleve tiempo operando, por lo que no se
  puede medir en una sesion de laboratorio.
- **RTO observado (laboratorio)**: ciclo respaldo -> verificacion -> descifrado ->
  importacion a base limpia con datos sinteticos. Medicion 2026-09-17 (SQLite en
  memoria, dataset sintetico de 1 factura/pago/caja): respaldo ~0.09 s,
  verificacion ~0.002 s, descifrado ~0.03 s, restauracion ~0.01 s, total ~0.15 s.
  **No se extrapola a produccion**: en el servidor real pesan el tamano de la
  base, el disco y el motor MariaDB; el ensayo debe repetirse en el servidor final.

Ambas rutas bare-metal ejecutan el mismo `schedule:run` (paridad con el sidecar
Docker), por lo que el RPO planificado no depende del runtime; si el scheduler
esta caido, el atraso es ilimitado y lo senala la alerta.

## 15. Reconciliacion de correlativos post-restore (HS-BK-SEQ)

Restaurar un respaldo antiguo puede perder documentos ya impresos. Regla
fail-closed:

1. Tras reemplazar la base, el procedimiento de restore ejecuta
   `php artisan hospital:restore-reconciliation start --reason="..."`. La emision
   de facturas y la reserva de recibos institucionales quedan **bloqueadas**.
2. Para reanudar hace falta un **manifiesto externo verificado** con los ultimos
   numeros usados/impresos y una copia externa `verified` del ledger
   `backup_external_copies` que coincida en `backup_log_id`, `sha256`,
   `destination_label` y `bytes`.
3. `php artisan hospital:restore-reconciliation confirm --manifest=... --phrase=RECONCILIAR
   --reason="..." --authorized-by="..."` valida el manifiesto, aplica solo avance
   de correlativos (nunca retrocede) y limpia el bloqueo con auditoria. Doble
   control: frase literal + responsable.
4. Si la copia externa del manifiesto se degrado (`failed`), el `confirm` se
   rechaza y el bloqueo permanece aunque el manifiesto tenga hash valido
   (regresion `BackupSequenceReconciliationBoundaryTest`).
5. `php artisan hospital:restore-reconciliation status --json` reporta pendiente,
   maximos actuales y ultimo manifiesto.
