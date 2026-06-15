# Guia de respaldos y restauracion

Los respaldos protegen facturas, pagos, caja, catalogo, usuarios, reportes y configuracion.

## Regla principal

Un respaldo es confiable solo si aparece:

- Completado.
- Con tamano mayor a cero.
- Con huella SHA256.
- Copiado a un medio seguro cuando administracion lo requiera.

## Crear respaldo manual

1. Entre a **Respaldos** como administrador.
2. Presione **Crear respaldo**.
3. Espere que el estado cambie a **Completado**.
4. Revise tamano y huella SHA256.
5. Descargue o copie el respaldo a USB/disco externo autorizado.

Si queda **Pendiente** por mucho tiempo, avise al responsable tecnico.

## Respaldos automaticos

El sistema debe tener respaldos automaticos:

La hora del respaldo diario debe escribirse en formato de 24 horas `HH:mm`, por
ejemplo `02:00` o `23:30`. Si el tecnico actualiza las tareas con una hora
mal escrita, el instalador debe detenerse antes de reemplazar tareas existentes.
El loop de automatizacion tambien se detiene al inicio si la hora esta mal
escrita, dejando el motivo en `backend\storage\logs\backup-automation.log`.

Antes de activar respaldos en una PC instalada, soporte puede ejecutar estas
verificaciones sin iniciar workers ni crear respaldos. Funcionan tanto en
instalacion PHP local como en paquete Docker offline:

```powershell
scripts\run_backup_worker.cmd --check
scripts\run_scheduled_backup.cmd --check
scripts\start_backup_automation.cmd --check
```

## Retencion de respaldos

El sistema conserva por defecto los 30 respaldos exitosos mas recientes. Ajuste
`HOSPITAL_BACKUP_KEEP_SUCCESSFUL=30` en `.env` solo si el responsable tecnico
aprueba otra politica. Los respaldos fallidos o pendientes no se podan, porque
sirven como evidencia de operacion y diagnostico.

Si una verificacion falla, no reintente muchas veces. Revise primero el mensaje:
PHP no encontrado, instalacion incompleta, permisos insuficientes o falta de
espacio. Luego genere paquete de soporte.

Si no hay permisos de administrador para tareas de Windows, soporte puede usar
el arranque por usuario actual. Primero valide sin tocar registro ni iniciar
procesos:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -WhatIfOnly
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status
```

La salida de estado no debe mostrar rutas locales crudas ni el contenido del
archivo Startup.

En paquete Docker offline, estas verificaciones requieren que `setup.bat` ya
haya creado `.env`. Si `.env` falta, deben detenerse antes de tocar datos.

El responsable tecnico puede validar que el worker procesa respaldos sin dejar
la contrasena escrita en el historial de PowerShell:

```powershell
$env:HOSPITAL_SMOKE_BASE_URL = "http://IP-DEL-SERVIDOR:8000"
$env:HOSPITAL_SMOKE_LOGIN = "usuario.soporte"
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_backup_worker_smoke.ps1
```

No escriba usuario, contrasena ni token dentro de `HOSPITAL_SMOKE_BASE_URL`.
Use `http://IP-DEL-SERVIDOR:8000`; el script rechaza direcciones como
`http://usuario:contrasena@IP-DEL-SERVIDOR:8000` para que la URL no quede en
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

El administrador debe revisar el historial todos los dias.

## Restauracion segura

Restaurar puede reemplazar informacion. No se hace directo desde la pantalla de respaldos.

Antes de restaurar:

1. Detener facturacion y avisar al personal.
2. Crear respaldo nuevo del estado actual.
3. Confirmar archivo a restaurar.
4. Verificar huella SHA256.
5. Restaurar primero en una base descartable.
6. Revisar login, usuarios, servicios, facturas, pagos, caja, reportes y respaldos.
7. Solo despues de validar, decidir restauracion de produccion.

## Evidencia minima

Anote:

- Fecha y hora.
- Responsable.
- Archivo usado.
- Huella SHA256.
- Base descartable usada para prueba.
- Resultado de login.
- Conteos revisados: usuarios, servicios, facturas, pagos, cajas y respaldos.
- Firma o aprobacion de administracion.

## Senales de alerta

Avise si ve:

- Respaldo fallido.
- Muchos respaldos pendientes.
- Tamano cero.
- Sin respaldo reciente.
- La huella SHA256 no aparece.
- Mensaje de disco lleno o permisos.
