# Backup y Restore Local - Sistema de Caja Hospitalaria

## Alcance

El sistema permite crear y descargar backups locales desde admin y con `php artisan hospital:backup`.
La restauracion no expone un endpoint destructivo ni se ejecuta dentro del navegador:
se realiza en la computadora servidor mediante el acceso **Mantenimiento S_Hospital**
y el helper local protegido.

## Crear backup manual

Desde el panel:

1. Entrar como usuario admin.
2. Abrir Backups locales.
3. Presionar Crear backup.
4. Confirmar que el registro quede en `pending`.
5. Confirmar que el worker local lo cambie a `success`.
6. Descargar el archivo cifrado y copiarlo a una carpeta local protegida o USB.

El servidor debe tener un worker de cola local activo. En instalacion
bare-metal/XAMPP:

```powershell
cd C:\HospitalBilling\backend
php artisan queue:work --queue=backups --tries=1 --timeout=600
```

En paquete offline con Docker, el servicio `queue-worker` de
`docker-compose.prod.yml` debe estar activo:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env up -d queue-worker
```

Desde consola del servidor bare-metal:

```powershell
cd C:\HospitalBilling\backend
php artisan hospital:backup --type=scheduled
```

Desde paquete offline con Docker:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env exec -T backend php artisan hospital:backup --type=scheduled
```

El comando crea y ejecuta el backup en el mismo proceso; se recomienda para ejecuciones puntuales fuera del horario de caja. La UI registra el backup y lo deja a la cola `backups` para evitar que el navegador espere el dump completo.

Los archivos quedan bajo `storage/app/private/backups`. El API solo descarga archivos registrados en `backup_logs`, existentes y dentro de esa carpeta. Desde la correccion de hardening F8, el formato esperado es `.sql.gz.enc`: SQL comprimido con gzip y cifrado localmente antes de publicarse.

## Cifrado de backups

Configurar en `.env` del servidor:

```env
HOSPITAL_BACKUP_ENCRYPTION_KEY=valor-largo-aleatorio-generado-en-instalacion
```

Notas operativas:

- No guardar esa clave dentro del repositorio ni en capturas de pantalla.
- Copiar la clave a un sobre/medio administrativo separado; sin ella no se puede restaurar un `.sql.gz.enc`.
- En produccion, si falta `HOSPITAL_BACKUP_ENCRYPTION_KEY`, el backup debe fallar con mensaje operativo en vez de crear SQL plano.
- El checksum `checksum_sha256` corresponde al paquete cifrado descargable, no al SQL interno.

## Retencion local

Por defecto el sistema conserva backups por tipo y por edad minima. La poda corre despues de crear un backup nuevo:

```env
HOSPITAL_BACKUP_KEEP_MANUAL_SUCCESSFUL=10
HOSPITAL_BACKUP_KEEP_MANUAL_DAYS=30
HOSPITAL_BACKUP_KEEP_SCHEDULED_SUCCESSFUL=96
HOSPITAL_BACKUP_KEEP_SCHEDULED_DAYS=7
```

La retencion nunca elimina backups `pending` o `failed`; esos registros quedan como evidencia operativa. La poda solo borra archivos locales con ruta segura bajo `backups/`, respeta tipo `manual`/`scheduled`, conserva siempre los mas recientes segun politica y registra auditoria `backup.pruned`.

## Antes de migraciones productivas

El entrypoint del backend ejecuta `php artisan hospital:verify-migration-backup`
antes de migrar. El guard bloquea la migracion si la instalacion tiene datos y
no existe un respaldo cifrado, integro y recuperable dentro de la ventana
configurada. No existe una variable booleana de confirmacion manual: la unica
forma de habilitar el upgrade es tener un `backup_logs` con estado `success`
verificado. Para un upgrade:

1. Crear un backup manual y esperar estado `success`.
2. El guard comprueba `encrypted`, disco local, ruta segura, archivo presente,
   tamano, `checksum_sha256`, `encryption_key_id` vigente y que el primer bloque
   se descifre con la clave configurada. Registrar fecha/hora y responsable.
3. Conservar `HOSPITAL_BACKUP_ENCRYPTION_KEY` fuera del repositorio.
4. Ejecutar el upgrade: el guard corre dentro del entrypoint (Docker) o antes de
   migrar en el despliegue; si bloquea, cree el respaldo y reintente.

La ventana de antiguedad se ajusta con `HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS`
(horas; default 72). Una instalacion genuinamente vacia (sin tablas, o sin
migraciones aplicadas y sin datos de dominio) puede migrar sin respaldo previo.

Para diagnosticar antes de una ventana de mantenimiento:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env exec -T backend php artisan hospital:verify-migration-backup --json
```

El backend busca `mariadb-dump` o `mysqldump` en el `PATH` y en rutas locales comunes como `C:\xampp\mysql\bin\mysqldump.exe`. Si el servidor usa otra ruta, definir:

```powershell
HOSPITAL_DUMP_BINARY=C:\ruta\mysql\bin\mysqldump.exe
```

## Programacion automatica diaria

El backend registra una tarea Laravel diaria:

```powershell
cd C:\HospitalBilling\backend
php artisan schedule:list
php artisan schedule:run
```

Por defecto el schedule ejecuta `hospital:backup --type=scheduled` a las `02:00`. La hora se puede ajustar con `HOSPITAL_DAILY_BACKUP_TIME=HH:MM` en `.env` antes de ejecutar `php artisan config:cache`.

En produccion debe existir exactamente UN mecanismo de scheduler por host
(nunca dos), y todos ejecutan el mismo `schedule:run` de Laravel:

- Docker (`docker-compose.prod.yml`): sidecar `scheduler`, cada 60 segundos.
- Bare-metal con loop de usuario (T3-003): `scripts\run_backup_scheduler_loop.ps1`,
  instalado con `scripts\install_backup_startup_current_user.ps1`, cada 60 segundos.
- Bare-metal con tareas Windows: `scripts\install_backup_tasks_windows.ps1`
  registra `HospitalBillingOS-BackupWorker` (cola `backups`, al iniciar Windows)
  y `HospitalBillingOS-Scheduler` (cada 1 minuto), que ejecuta
  `schedule:run --no-interaction` y registra `hospital:scheduler-tick`.

La tarea legacy `HospitalBillingOS-DailyBackup` (respaldo directo) esta retirada:
registrarla de nuevo duplicaria el schedule de Laravel y `schedule:run` es el
unico dueno de los respaldos programados. `-UpdateExisting` la desregistra de
instalaciones antiguas. El backup automatico aparece en la UI como creado por
`Sistema` porque no depende de un usuario web. La creacion y descarga manual
desde navegador siguen permitidas solo para usuarios con permisos
`backups.create` y `backups.download`.

## Programar la automatizacion en Windows (bare-metal)

No cree una tarea directa `php artisan hospital:backup --type=scheduled`: el
schedule de Laravel (`backend/routes/console.php`) es el unico dueno de los
respaldos programados y la hora efectiva es `HOSPITAL_DAILY_BACKUP_TIME` en
`backend\.env` (regenerar `php artisan config:cache` al cambiarla). Para
instalaciones bare-metal use el registrador incluido:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -WhatIfOnly
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -PhpPath C:\xampp\php\php.exe
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status
```

El registrador crea dos tareas:

- `HospitalBillingOS-BackupWorker`: worker de la cola `backups` (respaldos de
  UI), al iniciar Windows.
- `HospitalBillingOS-Scheduler`: cada minuto ejecuta
  `schedule:run --no-interaction` y registra el heartbeat
  `hospital:scheduler-tick`; de ahi corren el respaldo diario, los operativos
  06:00-18:00, salud, verificacion y podas.

Notas de uso:

- `-WhatIfOnly` no registra nada y muestra el plan; revise la salida antes de
  compartirla, porque incluye rutas locales del servidor.
- El registrador es solo para instalaciones bare-metal con `backend\artisan` y
  PHP local. En Docker el scheduler es el sidecar `scheduler` de
  `docker-compose.prod.yml`; no registre tareas Windows en ese modo.
- Si las tareas ya existen (incluida la legacy `HospitalBillingOS-DailyBackup`),
  el script falla sin sobrescribir; use `-UpdateExisting` para reemplazarlas y
  retirar la legacy. Para desinstalar: `-Uninstall`.
- Registrar, actualizar y desinstalar requiere PowerShell como administrador.
- Despues de registrar, cree un backup desde la UI y confirme que pasa de
  `pending` a `success`; confirme la corrida del scheduler con
  `Get-ScheduledTaskInfo -TaskName HospitalBillingOS-Scheduler`.

Tambien hay wrappers directos para uso manual o por los mecanismos anteriores:

```powershell
scripts\run_backup_worker.cmd        # worker de la cola backups
scripts\start_backup_automation.cmd  # arranca el loop de usuario (T3-003)
scripts\run_scheduled_backup.cmd     # respaldo scheduled directo (legacy)
```

`run_backup_worker.cmd` y `run_scheduled_backup.cmd` aceptan la ruta de PHP como
primer argumento (con prioridad sobre `HOSPITAL_PHP_PATH`); sin argumento usan
`HOSPITAL_PHP_PATH` y, si no esta definido, `C:\xampp\php\php.exe`. En ambos
wrappers, si la ruta resultante no existe, usan `php` del PATH.
`start_backup_automation.cmd` no acepta ese argumento: solo usa
`HOSPITAL_PHP_PATH` (por defecto `C:\xampp\php\php.exe`) y el fallback a `php`
del PATH ocurre en `run_backup_scheduler_loop.ps1` cuando la ruta no existe.

`run_scheduled_backup.cmd` y el flujo directo `hospital:backup --type=scheduled`
quedan como compatibilidad heredada: no se registran como tarea porque
duplicarian el schedule de Laravel. La automatizacion vigente es la de la
seccion anterior. El log operativo del loop de usuario queda en
`backend/storage/logs/backup-automation.log`.

Si el Programador de tareas esta bloqueado por permisos/UAC, existe una alternativa por usuario actual:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -PhpPath C:\xampp\php\php.exe
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status
scripts\start_backup_automation.cmd
```

Esta alternativa arranca el worker y ejecuta `schedule:run` cada 60 segundos al
iniciar sesion del usuario Windows. No sustituye una tarea de sistema para
produccion final, pero deja la automatizacion de respaldos activa sin permisos
de administrador mientras ese usuario permanezca iniciado.
El instalador registra tanto un archivo en la carpeta Startup como una entrada `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` para tolerar politicas locales donde uno de los dos mecanismos este restringido.
El parametro `-DailyBackupTime` se acepta solo por compatibilidad en el
registrador y en el loop, y ninguno lo usa para programar el respaldo: la hora
efectiva es `HOSPITAL_DAILY_BACKUP_TIME` en `backend\.env`. Matiz de esta ruta
por usuario actual: `install_backup_startup_current_user.ps1` escribe
`HOSPITAL_DAILY_BACKUP_TIME=<parametro>` (default `02:00`) en el `.cmd` de
inicio y `start_backup_automation.cmd` conserva ese valor (o aplica el mismo
default) en el entorno del loop, que no lo usa para programar pero lo hereda
hacia `php artisan schedule:run`. Como Dotenv no sobreescribe variables ya
presentes en el entorno, sin `config:cache` ese valor exportado puede prevalecer
sobre `backend\.env`; ejecute `php artisan config:cache` despues de ajustar la
hora. Use `-Status` para confirmar si la automatizacion ya esta instalada para
el usuario actual; `-StartNow` arranca el loop de inmediato.
El log operativo queda en `backend/storage/logs/backup-automation.log`.

> Nota 2026-09-14 (T3-011/T3-016/T3-017): la automatizacion vigente es Worker +
> Scheduler (`hospital:backup` solo via `schedule:run`); la tarea directa
> `HospitalBillingOS-DailyBackup` quedo retirada y `-UpdateExisting` la
> desregistra. Evidencia: `hospital-ai/evidencia/T3-011/INFORME.md` y
> `hospital-ai/evidencia/T3-016/INFORME.md` (T3-017 agrega esta nota).

Despues de cada backup diario, copiar el archivo mas reciente a una unidad USB o disco externo del hospital. No usar servicios cloud como requisito operativo.

## Restore manual en entorno de prueba

Restore debe probarse en una base limpia de prueba, nunca directo en produccion sin parada controlada.

En Windows puede usarse el helper seguro incluido en el repositorio. Primero
ejecute el self-test; no toca bases ni backups:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 -SelfTest
```

Para restaurar un backup en una base descartable usando las credenciales de
`backend\.env` pero sin usar la base activa, calcular primero el SHA-256 del
paquete cifrado:

```powershell
Get-FileHash C:\backups\hospital-backup.sql.gz.enc -Algorithm SHA256
```

Luego ejecutar el helper seguro contra una base descartable. El helper descifra
el `.sql.gz.enc` internamente a un SQL temporal y exige el checksum esperado:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 `
  -UseExistingEnv `
  -TargetDatabase hospital_restore_validation `
  -BackupFile C:\backups\hospital-backup.sql.gz.enc `
  -ExpectedSha256 <sha256>
```

El nombre de `-TargetDatabase` debe contener `test`, `restore`, `validation`,
`disposable` o `proof`, y solo puede usar letras, numeros y `_`. El script
rechaza `hospital_billing`, `hospital_billing_production` y bases del sistema.
El helper elimina y recrea la base descartable antes de importar, de modo que
una validacion repetida nunca mezcle datos de una ejecucion anterior. Todos los
datos que ya existan en esa base de prueba se perderan. Los backups nuevos son
`.sql.gz.enc`; el helper seguro los descifra a un SQL temporal con la clave
local antes de alimentar `mysql`.

Pasos para MySQL/MariaDB:

1. Confirmar que el archivo de backup viene de `backup_logs` con estado `success`.
2. Verificar checksum del paquete cifrado:

```powershell
Get-FileHash C:\backups\hospital-backup.sql.gz.enc -Algorithm SHA256
```

3. Descifrar/descomprimir en una ubicacion temporal protegida del servidor de validacion. Borrar el `.sql` temporal al terminar:

```powershell
cd backend
php artisan hospital:decrypt-backup C:\backups\hospital-backup.sql.gz.enc C:\backups\hospital-backup.sql
```

4. Recrear una base de prueba limpia:

```powershell
mysql -u root -p -e "DROP DATABASE IF EXISTS hospital_restore_test; CREATE DATABASE hospital_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

5. Restaurar en la base de prueba:

```powershell
mysql -u hospital -p hospital_restore_test < C:\backups\hospital-backup.sql
```

6. Apuntar un `.env` temporal de prueba a `hospital_restore_test`.
7. Ejecutar validaciones:

```powershell
php artisan migrate:status
php artisan config:cache
php artisan test --colors=never
```

8. Validar en navegador local de prueba:
   - `/up` responde OK.
   - `/login` carga.
   - Admin puede iniciar sesion.
   - Existen usuarios, permisos, servicios, facturas, pagos y cajas esperadas.
   - Ultimo backup aparece en `backup_logs`.

## Restore en produccion

Solo personal autorizado debe usar la recuperacion productiva desde la
computadora servidor. No se ejecuta desde la pagina de Backups.

Antes de iniciar:

1. Avisar la parada operativa y cerrar todas las cajas abiertas.
2. Tener el paquete cifrado y su SHA-256 esperado.
3. Confirmar que el ensayo descartable del mismo paquete puede completarse.
4. Conservar la clave local de cifrado fuera del repositorio.

En una instalacion Docker, abrir **Mantenimiento S_Hospital** o ejecutar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 `
  -ProductionRecovery `
  -BackupFile C:\backups\hospital-backup.sql.gz.enc `
  -ExpectedSha256 <sha256>
```

El asistente exige escribir exactamente el nombre de la base activa y
`RESTAURAR`. Antes de reemplazar datos valida el paquete en una base
descartable, comprueba que no haya cajas abiertas y crea un respaldo preventivo.
Luego activa mantenimiento, detiene los escritores, restaura, ejecuta
migraciones, audita las reglas institucionales y verifica la salud.

Si la restauracion o la verificacion falla despues del reemplazo, intenta
rollback con el respaldo preventivo y mantiene la aplicacion en mantenimiento.
No se debe forzar la salida de mantenimiento hasta revisar el resultado.

## Checklist de evidencia minima

- Fecha y hora de la validacion y de la recuperacion.
- Equipo donde se probo.
- Identificador relativo del respaldo, sin ruta absoluta.
- Coincidencia del SHA-256 esperado y calculado.
- Resultado del respaldo preventivo.
- Resultado de migraciones, auditoria de catalogo y verificacion de salud.
- Resultado del rollback cuando se haya ejercitado.
- Conteos minimos revisados: users, roles, permissions, services, invoices,
  invoice_items, payments, cash_register_sessions, cash_movements y backup_logs.
- Estado final de mantenimiento y de los procesos escritores.
- Firma o nombre del responsable local.

## Script Fase 10 (historico; script retirado)

> Nota 2026-09-13: `scripts/validate_restore_mysql.sh` no existe en el arbol
> actual ni viaja en el paquete offline. La validacion vigente de restore en base
> descartable se ejecuta con `scripts\restore_hospital_windows.ps1` (con
> `-UseExistingEnv -TargetDatabase ... -ExpectedSha256 ...`) o desde la consola
> `scripts\maintenance_hospital_windows.ps1`; ambas exigen sufijos seguros en el
> nombre de la base y nunca restauran sobre la base activa. La evidencia debe
> registrarse bajo `qa/`, por ejemplo `qa/RECOVERY_CERTIFICATION.md` a partir de
> `qa/RECOVERY_CERTIFICATION.example.md`.

## Evidencia Fase 11 (historica)

Restore real validado el 2026-05-17 en MariaDB XAMPP local:

- Base fuente: `hospital_billing`.
- Base descartable restaurada: `hospital_restore_validation_test`.
- Backup: `hospital-backup-20260517-204322-lcsexyiz.sql`.
- SHA256: `5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362`.
- Resultado: `scripts/validate_restore_mysql.sh` (script retirado) completo sin restaurar sobre la base activa.
- Conteos en base restaurada: users 3, roles 3, permissions 27, services 122, invoices 1, payments 1, cash_register_sessions 1, backup_logs 5.

Esta evidencia no sustituye repetir la prueba en el servidor final si cambian equipo, ruta de dump, credenciales locales o base de datos de produccion.
