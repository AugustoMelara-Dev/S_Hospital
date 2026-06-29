# Backup y Restore Local - Sistema de Caja Hospitalaria

## Alcance de Fase 8

El sistema permite crear y descargar backups locales desde admin y con `php artisan hospital:backup`. No existe restore por UI ni endpoint destructivo de restore en esta fase.

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

El comando crea y ejecuta el backup en el mismo proceso; se recomienda para tareas programadas fuera del horario de caja. La UI registra el backup y lo deja a la cola `backups` para evitar que el navegador espere el dump completo.

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

El contenedor backend bloquea migraciones pendientes sobre una base ya inicializada si `APP_ENV=production` y no se confirma un backup cifrado reciente. Para un upgrade:

1. Crear un backup manual y esperar estado `success`.
2. Registrar `checksum_sha256`, fecha/hora y responsable.
3. Conservar `HOSPITAL_BACKUP_ENCRYPTION_KEY` fuera del repositorio.
4. Ejecutar el upgrade con `HOSPITAL_MIGRATION_BACKUP_CONFIRMED=1` solo para esa ventana de mantenimiento.

No usar esta variable para saltarse backups rutinarios; es una confirmacion operativa de que existe un restore point antes de modificar el esquema.

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

Por defecto corre `hospital:backup --type=scheduled` a las `02:00`. La hora se puede ajustar con `HOSPITAL_DAILY_BACKUP_TIME=HH:MM` en `.env` antes de ejecutar `php artisan config:cache`.

En Windows de produccion se recomienda usar el helper de abajo. El helper detecta
si la instalacion tiene `backend\artisan` y registra tareas PHP local; si el
paquete es offline Docker y no trae `backend\artisan`, registra wrappers que
llaman `docker compose` contra `docker-compose.prod.yml`. El backup automatico
queda registrado como usuario `Sistema` en la UI porque no depende de un usuario
web. La creacion y descarga manual desde navegador siguen permitidas solo para
usuarios con permisos `backups.create` y `backups.download`.

## Programar backup diario en Windows

Crear una tarea del Programador de tareas:

- Programa: `php`
- Argumentos: `artisan hospital:backup --type=scheduled`
- Iniciar en: `C:\HospitalBilling\backend`
- Frecuencia: diario, fuera del horario de caja.
- Usuario: cuenta local con permisos sobre la carpeta del sistema y destino USB si aplica.

Crear otra tarea o servicio local para el worker:

- Programa: `php`
- Argumentos: `artisan queue:work --queue=backups --tries=1 --timeout=600`
- Iniciar en: `C:\HospitalBilling\backend`
- Frecuencia: al iniciar Windows o como servicio supervisado.

Helper para registrar las tareas de Windows:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -WhatIfOnly
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -PhpPath C:\xampp\php\php.exe
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status
```

El helper crea una tarea de worker al iniciar Windows y una tarea diaria de
backup programado. Primero ejecutar `-WhatIfOnly` para confirmar rutas y el
runtime real: `PHP local` o `Docker Compose`.
La salida de `-WhatIfOnly` oculta rutas locales como `%PROJECT_ROOT%` y
`[php-configurado]`; esto es intencional para que la captura se pueda enviar a
soporte sin exponer carpetas del servidor. Las tareas reales conservan las rutas
necesarias internamente para poder ejecutarse.
Si `-PhpPath` apunta a una ruta inexistente en modo PHP local, el helper se
detiene antes de registrar tareas para evitar respaldos automaticos rotos. En
modo Docker, el helper exige `docker`, `docker compose`, `.env` y compose
productivo validos antes de registrar tareas.
Si las tareas ya existen, el helper falla sin sobrescribirlas; usar
`-UpdateExisting` para reemplazarlas explicitamente. Para desinstalarlas, usar
`-Uninstall`. La instalacion, actualizacion y desinstalacion requieren abrir
PowerShell como administrador.

Tambien se incluyen wrappers directos. Detectan automaticamente modo PHP local o
modo Docker offline:

```powershell
scripts\run_scheduled_backup.cmd
scripts\run_backup_worker.cmd
scripts\start_backup_automation.cmd
```

En modo PHP local, por defecto usan `C:\xampp\php\php.exe`. Si PHP esta en otra
ruta, definir `HOSPITAL_PHP_PATH` antes de ejecutarlos o al crear la tarea
programada. En modo Docker offline no requieren PHP host; usan
`docker-compose.prod.yml` y `.env`.
Antes de dejarlos activos, soporte puede validarlos sin iniciar workers ni crear
respaldos:

```powershell
scripts\run_backup_worker.cmd --check
scripts\run_scheduled_backup.cmd --check
scripts\start_backup_automation.cmd --check
```

Si la validacion falla, el mensaje debe indicar una accion simple: revisar PHP o
Docker segun el modo, permisos, espacio en disco, `.env` o instalacion completa.
Los detalles tecnicos quedan en `backend/storage/logs/*` para modo PHP local o
en `install-logs\backup_worker_task.log`,
`install-logs\backup_scheduled_task.log` y
`install-logs\backup-automation.log` para modo Docker offline.

Si el Programador de tareas esta bloqueado por permisos/UAC, existe una alternativa por usuario actual:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -PhpPath C:\xampp\php\php.exe -DailyBackupTime 02:00
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status
scripts\start_backup_automation.cmd
```

Esta alternativa arranca el worker y un scheduler local al iniciar sesion del usuario Windows. No sustituye una tarea de sistema para produccion final, pero deja backup diario automatico sin permisos de administrador mientras ese usuario permanezca iniciado.
El instalador registra tanto un archivo en la carpeta Startup como una entrada `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` para tolerar politicas locales donde uno de los dos mecanismos este restringido.
Primero use `-WhatIfOnly`: valida hora y PHP sin crear archivo Startup, sin
cambiar registro y sin iniciar el worker. El modo `-Status` no imprime el
contenido crudo del archivo Startup; muestra solo estado y rutas protegidas para
evitar exponer carpetas locales en capturas de soporte.
El log operativo queda en `backend/storage/logs/backup-automation.log`.

Despues de cada backup diario, copiar el archivo mas reciente a una unidad USB o disco externo del hospital. No usar servicios cloud como requisito operativo.

## Restore manual en entorno de prueba

Restore debe probarse en una base limpia de prueba, nunca directo en produccion sin parada controlada.

En Windows puede usarse el helper seguro incluido en el repositorio. Primero
ejecute el self-test; no toca bases ni backups:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 -SelfTest
```

Para restaurar un backup en una base descartable usando las credenciales de
`backend\.env` pero sin usar la base activa:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 -UseExistingEnv -TargetDatabase hospital_restore_validation -BackupFile C:\backups\hospital-backup.sql
```

El nombre de `-TargetDatabase` debe contener `test`, `restore`, `validation`,
`disposable` o `proof`, y solo puede usar letras, numeros y `_`. El script
rechaza `hospital_billing`, `hospital_billing_production` y bases del sistema.
Los backups nuevos son `.sql.gz.enc`; deben descifrarse y descomprimirse con la
clave del servidor antes de alimentar `mysql`.

Pasos para MySQL/MariaDB:

1. Confirmar que el archivo de backup viene de `backup_logs` con estado `success`.
2. Verificar checksum del paquete cifrado:

```powershell
Get-FileHash C:\backups\hospital-backup.sql.gz.enc -Algorithm SHA256
```

3. Descifrar/descomprimir en una ubicacion temporal protegida del servidor de validacion. Borrar el `.sql` temporal al terminar.
4. Crear base de prueba limpia:

```powershell
mysql -u root -p -e "CREATE DATABASE hospital_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
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

Restore en produccion requiere:

1. Avisar parada operativa y detener acceso de clientes LAN.
2. Crear un backup nuevo antes del restore.
3. Copiar la base actual a un destino externo.
4. Validar checksum del archivo que se restaurara.
5. Restaurar primero en prueba si no se hizo antes.
6. Restaurar en produccion con el servicio web detenido o en modo mantenimiento.
7. Ejecutar `php artisan config:cache`.
8. Validar `/up`, `/login`, `/verify-email`, login admin, listado de facturas, caja y reporte diario.
9. Documentar fecha, operador, archivo usado, checksum y resultado.

## Checklist de evidencia minima

- Fecha y hora del restore de prueba.
- Equipo donde se probo.
- Archivo restaurado.
- Checksum esperado y checksum calculado.
- Resultado de `php artisan migrate:status`.
- Resultado de `/up`, `/login`, `/verify-email`.
- Conteos minimos revisados: users, roles, permissions, services, invoices, payments, cash_register_sessions, backup_logs.
- Firma o nombre del responsable local.

## Script Fase 10

Para validar restore real en una base descartable MySQL/MariaDB:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh
```

El script no restaura sobre la base activa. Requiere cliente `mysql` y una herramienta de dump local (`mariadb-dump` o `mysqldump`). Si falta cualquiera de esas herramientas, el estado sigue `PENDING_ENVIRONMENT_VALIDATION`.
Cuando genera evidencia con `HOSPITAL_RESTORE_EVIDENCE_PATH`, el archivo de
backup queda identificado por nombre/ruta relativa bajo backups, SHA256 y
tamano. No debe escribirse una ruta absoluta del servidor en la evidencia que se
comparta con soporte. La ruta de evidencia debe ser un archivo `.md` bajo `qa/`,
por ejemplo `qa/FINAL_RESTORE_PROOF.md`; el script falla antes de crear backup o
tocar la base descartable si recibe una ruta absoluta, con `..` o con
backslashes.

## Evidencia Fase 11

Restore real validado el 2026-05-17 en MariaDB XAMPP local:

- Base fuente: `hospital_billing`.
- Base descartable restaurada: `hospital_restore_validation_test`.
- Backup: `hospital-backup-20260517-204322-lcsexyiz.sql`.
- SHA256: `5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362`.
- Resultado: `scripts/validate_restore_mysql.sh` completo sin restaurar sobre la base activa.
- Conteos en base restaurada: users 3, roles 3, permissions 27, services 122, invoices 1, payments 1, cash_register_sessions 1, backup_logs 5.

Esta evidencia no sustituye repetir la prueba en el servidor final si cambian equipo, ruta de dump, credenciales locales o base de datos de produccion.
