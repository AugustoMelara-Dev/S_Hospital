# Runbook de recuperacion de desastre

Este runbook cubre los incidentes mas frecuentes y como responder sin perder
datos. Esta pensado para el responsable tecnico del hospital (no para el
cajero).

## Antes de cualquier incidente

- Confirme que existe un respaldo reciente en la UI de Respaldos del sistema.
  Si el ultimo respaldo tiene mas de 24 horas, **primero** cree un respaldo
  manual antes de seguir.
- Confirme que la tarea `SistemaCajaHospitalaria-BackupWorker` esta
  `Running`. Si no lo esta, no hay worker procesando respaldos en cola.
- Tenga a mano: contrasena del admin inicial, ruta al paquete `offline-release`
  y la IP LAN del servidor.

## Escenario 1 - El servidor no enciende

1. Verifique energia, UPS y cable de red.
2. Si el disco esta danado, **no** intente levantar el sistema en el mismo
   disco. Lleve el disco a un equipo con MariaDB 10.6+ o MySQL 8.0+ y
   siga el escenario 5 (restore desde backup externo).
3. Si el disco esta bien, arranque el servidor y espere a que Docker
   levante los 4 servicios (backend, nginx, mysql, queue-worker). Use
   `docker compose ps` en la carpeta del proyecto.
4. Cuando `mysql` este `healthy`, los demas arrancan solos. Espere 60-90
   segundos y valide desde otra PC: `https://IP-SERVIDOR/up` debe
   devolver 200 con `status: ok`.

## Escenario 2 - La PC servidor enciende pero la base no responde

1. En la PC servidor, abra PowerShell como Administrador.
2. `docker compose ps`. Si `mysql` esta reiniciando, vea los logs:
   `docker compose logs --tail=200 mysql`.
3. Si ve `permission denied` sobre `/var/lib/mysql`, el volumen
   `mysql_prod_data` se corrompio. **No** intente reparar. Vaya al
   escenario 5.
4. Si ve `Waiting for innodb_initialize`, espere 2 minutos. Si pasa de 5
   minutos sin levantar, vaya al escenario 5.

## Escenario 3 - Olvide la contrasena del admin

1. Use el comando `auth:create-initial-admin` solo si no existe otro admin.
   Si ya existe, no sirve.
2. Para reiniciar la contrasena de un usuario existente, cree un admin
   temporal con el comando y desde la UI de Usuarios cambie la contrasena
   del admin original. Despues desactive el admin temporal.
3. Comando seguro (la contrasena se lee de variable de entorno, no de la
   linea de comandos):

   ```powershell
   $env:HOSPITAL_INITIAL_ADMIN_PASSWORD = Read-Host "Contrasena temporal" -AsSecureString
   docker compose exec -e HOSPITAL_INITIAL_ADMIN_PASSWORD backend php artisan auth:create-initial-admin --username=nuevoadmin --email=nuevo@hospital.local
   ```

4. Borre la variable: `Remove-Item Env:HOSPITAL_INITIAL_ADMIN_PASSWORD`.

## Escenario 4 - Se perdio la APP_KEY

1. La APP_KEY cifra cookies de sesion, tokens Sanctum y otros secretos.
   Sin ella, las sesiones existentes quedan invalidas.
2. **No** invente una nueva y la meta en `.env`. Todas las sesiones y
   tokens quedan inutilizables.
3. Genere una nueva con `php artisan key:generate --force`. La nueva
   clave invalida todos los "remember me" previos; los usuarios deberan
   volver a iniciar sesion.
4. Despues de generarla, `php artisan config:cache` y reinicie el
   servicio backend (`docker compose restart backend`).

## Escenario 5 - Tengo un backup `.sql` y necesito restaurar

1. Confirme que el archivo termina en `.sql` y tiene tamano mayor a
   100KB (un backup vacio indica problema).
2. Calcule SHA256 del archivo y compare con el que aparece en la UI
   de Respaldos. Si difiere, el archivo esta danado.
3. Cree una base de datos descartable con sufijo `disposable` o
   `validation` (la regla `RESTORE_TEST_DATABASE` exige este sufijo).
4. Restaure SOLO en la base descartable:

   ```bash
   HOSPITAL_VALIDATE_RESTORE_MYSQL=1 \
   RESTORE_TEST_DATABASE=hospital_restore_validation \
   HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation \
   bash scripts/validate_restore_mysql.sh
   ```

5. Si la validacion pasa, levante la base principal desde ese mismo
   backup SOLO si la base activa esta realmente danada. **No** restaure
   sobre la base activa sin confirmacion del responsable tecnico.
6. Documente el incidente en `qa/INCIDENT-YYYY-MM-DD.md` con el SHA256,
   tamano, fecha de backup y motivo del restore.

## Escenario 6 - La cola de respaldos esta llena de jobs fallidos

1. Vaya a la UI de Respaldos. Si ve badges rojos en "fallido", revise
   el error_message. Si dice "No se encontro mariadb-dump ni
   mysqldump", instale la herramienta en el servidor.
2. Para vaciar la cola sin afectar datos:

   ```powershell
   docker compose exec backend php artisan queue:clear
   ```

3. Despues, cree un respaldo manual desde la UI para verificar que la
   cola vuelve a procesar.

## Escenario 7 - La tarea Windows de backup no corre

1. `Get-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker`. Si
   el estado no es `Running`, reejecute el instalador:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -PhpPath C:\xampp\php\php.exe
   Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
   ```

2. Si la tarea se inicia y se detiene a los pocos segundos, revise
   `install-logs/` para ver el error. Casi siempre es PATH: el PHP
   no encuentra `mariadb-dump` o `mysqldump`.
3. Anada `C:\xampp\mysql\bin` (o la ruta de su MariaDB) al PATH del
   usuario que ejecuta la tarea.

## Escenario 8 - Disco del servidor lleno

1. Los sintomas: `pending_count` sube, `last_failure_at` aparece en la
   UI de Respaldos, no se emiten facturas nuevas.
2. Libere espacio borrando respaldos antiguos que ya esten copiados a
   USB o disco externo. NO borre respaldos sin confirmar primero que
   existe una copia externa.
3. `docker system prune -a` para limpiar imagenes y volumenes huerfanos
   (no toca los volumenes `mysql_prod_data` ni `backup_data`).
4. Reinicie los contenedores: `docker compose restart`.

## Escenario 9 - Cierre de caja no se puede hacer

1. La UI de Caja debe mostrar el motivo: "facturas pendientes por L. X".
2. Vaya a Historial, filtre por estado `issued` o `partial`, y cobre o
   anule cada factura.
3. Solo el admin con permiso `cash.close_any` puede cerrar la caja de
   otro usuario. Si la caja pertenece a un cajero que ya no esta, use
   ese permiso desde otro usuario.

## Escenario 10 - Restaurar paquete offline desde USB

1. Copie la carpeta `offline-release/` a la PC servidor. La carpeta
   pesa ~250MB e incluye 4 imagenes Docker precargadas.
2. Ejecute `setup.bat` como Administrador.
3. El instalador detecta las imagenes locales y no intenta descargarlas
   de internet. Si ve errores de pull, valide que los archivos `.tar`
   en `offline-images/` no estan corruptos (compare con `checksums.sha256`).
4. Despues de instalar, ejecute `assert_offline_release_clean.ps1` para
   confirmar que la copia corresponde al mismo commit que se entrego.

## Contacto de escalamiento

Documente en este runbook el contacto del soporte tecnico del hospital
y del proveedor del sistema. Si el incidente requiere restaurar base de
datos, **primero** documente y **segundo** restaure sobre base
descartable. La base activa solo se restaura con autorizacion escrita del
responsable tecnico.
