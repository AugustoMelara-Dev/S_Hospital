# Guia De Respaldos Y Restauracion

Los respaldos protegen la informacion de caja, facturas, pagos y configuracion.

## Reglas Basicas

- Revise el ultimo respaldo todos los dias.
- Cree respaldo antes de actualizaciones.
- Mantenga una copia fuera de la computadora servidor.
- No guarde la unica copia dentro del mismo disco.
- No restaure sin autorizacion administrativa.

## Crear Respaldo Manual

1. Entre a **Respaldos**.
2. Revise el estado general.
3. Presione **Crear respaldo ahora**.
4. Espere estado **Protegido**.
5. Copie el archivo a un medio seguro si corresponde.

## Respaldos Automaticos

El sistema puede programar respaldos:

- Durante operacion cada 15 minutos.
- Al cerrar caja.
- Una vez al dia.

Si un respaldo queda en **Pendiente** mucho tiempo, avise al responsable tecnico.

La hora del respaldo diario debe escribirse en formato de 24 horas `HH:mm`, por
ejemplo `02:00` o `23:30`. Si el tecnico actualiza las tareas con una hora
mal escrita, el instalador debe detenerse antes de reemplazar tareas existentes.
El loop de automatizacion tambien se detiene al inicio si la hora esta mal
escrita, dejando el motivo en `backend\storage\logs\backup-automation.log`.

Antes de activar respaldos en una PC instalada, soporte puede ejecutar estas
verificaciones sin iniciar procesos de respaldo ni crear respaldos. Funcionan tanto en
instalacion PHP local como en paquete Docker offline:

```powershell
scripts\run_backup_worker.cmd --check
scripts\run_scheduled_backup.cmd --check
scripts\start_backup_automation.cmd --check
```

## Retencion de respaldos

El sistema conserva por defecto los 30 respaldos protegidos mas recientes. Ajuste
`HOSPITAL_BACKUP_KEEP_SUCCESSFUL=30` en `.env` solo si el responsable tecnico
aprueba otra politica. Los respaldos en **Error** o **Pendiente** no se podan, porque
sirven como evidencia de operacion y diagnostico.

Si una verificacion falla, no reintente muchas veces. Revise primero el mensaje:
PHP no encontrado, instalacion incompleta, permisos insuficientes o falta de
espacio. Luego genere paquete de soporte.

Si no hay permisos de administrador para tareas de Windows, soporte puede usar
el arranque por usuario actual. Primero valide sin tocar registro ni iniciar
procesos:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -WhatIfOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status
```

La salida de estado no debe mostrar rutas locales crudas ni el contenido del
archivo Startup. Este fallback usa Startup/HKCU Run del usuario actual y no
reemplaza la validacion final de las tareas Windows de respaldo.

En paquete Docker offline, estas verificaciones requieren que `setup.bat` ya
haya creado `.env`. Si `.env` falta, deben detenerse antes de tocar datos.

El responsable tecnico puede validar que la automatizacion procesa respaldos sin dejar
la contrasena escrita en el historial de PowerShell:

```powershell
$env:HOSPITAL_SMOKE_BASE_URL = "https://IP-DEL-SERVIDOR"
$env:HOSPITAL_SMOKE_LOGIN = "usuario.soporte"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_backup_worker_smoke.ps1
```

No escriba usuario, contrasena ni token dentro de `HOSPITAL_SMOKE_BASE_URL`.
Use `https://IP-DEL-SERVIDOR`; el script rechaza direcciones como
`https://usuario:contrasena@IP-DEL-SERVIDOR` para que la URL no quede en
evidencia, consola ni historial.

El script pedira la contrasena en pantalla segura si no se define
`HOSPITAL_SMOKE_PASSWORD`. Use una cuenta temporal autorizada y elimine las
variables de entorno de la sesion cuando termine.
La evidencia se escribe por defecto en `qa\BACKUP_WORKER_SMOKE_PROOF.md`.
Si usa `-EvidencePath`, debe ser un archivo `.md` dentro de `qa\`; el script
rechaza rutas fuera de esa carpeta antes de pedir contrasena, abrir red o crear
un respaldo.

```powershell
Remove-Item Env:\HOSPITAL_SMOKE_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\HOSPITAL_SMOKE_LOGIN -ErrorAction SilentlyContinue
Remove-Item Env:\HOSPITAL_SMOKE_PASSWORD -ErrorAction SilentlyContinue
```

Si la validacion falla, lea el mensaje principal antes de reintentar:

- Servidor o red: confirme que el sistema abre desde el navegador del servidor
  y que la direccion `BaseUrl` usa la IP o nombre LAN correcto.
- Sesion o contrasena: use una cuenta autorizada y vuelva a ejecutar el script.
- Permisos: pida a un administrador que habilite acceso a respaldos para la
  cuenta de soporte.
- Error interno: no repita muchas veces; genere el paquete de soporte y revise
  los logs con el responsable tecnico.

## Restauracion

Restaurar cambia la informacion disponible en el sistema. Debe hacerse solo con autorizacion.
No existe restauracion por interfaz normal para evitar que un usuario reemplace
datos reales por accidente.

Antes de restaurar:

1. Detenga la facturacion.
2. Cree una copia del estado actual si es posible.
3. Confirme cual respaldo se usara.
4. Pruebe la restauracion en una base descartable, nunca sobre la base real de
   produccion.
5. Documente fecha, motivo y responsable.

El responsable tecnico debe usar una base de prueba con nombre claro, por
ejemplo `hospital_restore_validation_YYYYMMDD`, y confirmar que es distinta de
la base activa. No use nombres como la base real de produccion.

La validacion final se documenta en:

```text
qa\FINAL_BACKUP_TASK_PROOF.md
qa\FINAL_RESTORE_PROOF.md
```

`qa\FINAL_BACKUP_TASK_PROOF.md` debe confirmar que
`SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup`
estan instaladas/listas, que un respaldo manual creado desde la UI paso de
Pendiente a Protegido, y que la evidencia no adjunta `.env`, dumps SQL, passwords,
XML de tareas ni rutas absolutas.

`qa\FINAL_RESTORE_PROOF.md` debe incluir respaldo usado, SHA256, tamano, base
origen, base descartable, conteos principales y conclusion. Si cualquier archivo
tiene placeholders, rutas locales no verificables o no prueba una base
descartable cuando corresponde, no sirve para entrega.

Comando de referencia para Linux/Docker o Git Bash:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test bash scripts/validate_restore_mysql.sh
```

Si se usa Windows/XAMPP, el procedimiento debe seguir la misma regla: restaurar
en base descartable, verificar conteos y conservar evidencia. Nunca restaure
sobre la base activa para "probar".

No ejecute seeders de prueba despues de restaurar un respaldo. Una restauracion
de validacion debe demostrar que el archivo recupera los datos respaldados, no
crear datos nuevos.

No agregue archivos `.env`, respaldos SQL ni carpetas completas de datos al
paquete de soporte. Use `scripts\collect_support_packet.ps1` para preparar
evidencia recortada y segura.

## Senales De Alerta

Avise si ve:

- Estado **Error**.
- Muchos respaldos en **Pendiente**.
- Archivo con tamano cero.
- Falta de respaldo reciente.
- Mensajes de permisos o disco lleno.
