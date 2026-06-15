# Guia De Instalacion Operativa

Esta guia es para dejar una computadora Windows como servidor local del Hospital San Isidro.

## Antes de instalar

Confirme:

- La computadora sera el servidor local.
- Tiene energia estable.
- Tiene IP fija o reservada en la red local.
- La impresora institucional esta instalada.
- La red LAN permite que otras computadoras abran el navegador hacia el servidor.
- Existe respaldo si se esta actualizando una instalacion anterior.

No borre carpetas de datos ni base de datos existente.

Si el instalador detecta una instalacion previa, use solamente reparar,
actualizar conservando base de datos o cancelar para pedir soporte. El instalador
no debe ofrecer una opcion de "instalacion limpia" que borre volumenes o datos
del hospital.

## Instalar

1. Abra la carpeta del sistema en el servidor.
2. Confirme que ya existe `frontend\dist\index.html`. Produccion offline no debe descargar dependencias al arrancar.
3. Ejecute `setup.bat` si administracion tecnica lo autorizo.
4. Si se usa el asistente PowerShell, ejecute `scripts\install_hospital_os.ps1` y seleccione migraciones seguras.
5. No use herramientas de reset ni bases de demostracion en el servidor real.
6. Espere a que los servicios levanten.
7. Verifique que exista el acceso directo **Abrir Sistema de Caja Hospitalaria** o el acceso directo definido para el hospital.
8. Abra el sistema desde el servidor.

El instalador no debe cargar datos temporales en produccion.
El instalador debe aplicar migraciones seguras sin borrar datos, sin ejecutar
`migrate:fresh` y sin correr seeders de demostracion. Tambien debe dejar
`APP_VERSION` configurado para que el diagnostico identifique la version
instalada.

Antes de entregar el servidor, administracion tecnica debe ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installer_safety.ps1
```

La revision debe terminar sin hallazgos. Si falla, no continuar la entrega hasta corregir el script indicado.

## Direccion de acceso

Servidor:

```text
http://127.0.0.1:8000
```

Clientes de red:

```text
http://IP-DEL-SERVIDOR:8000
```

Nunca escriba usuario, contrasena ni token dentro de la direccion del sistema.
Use `http://IP-DEL-SERVIDOR:8000`, no una direccion con formato
`http://usuario:contrasena@IP-DEL-SERVIDOR:8000`. Los scripts operativos
rechazan ese formato para que no quede guardado en accesos directos, logs ni
diagnosticos.

Antes de validar desde clientes, confirme que `APP_URL` usa la IP o nombre LAN
del servidor. Si queda en `localhost` o `127.0.0.1`, solo funcionara en la
computadora servidor y los clientes no encontraran el sistema.

## Arranque Automatico

El script `scripts/install_hospital_startup_shortcut.ps1` crea el acceso directo. Si el tecnico lo autoriza, puede registrar una tarea al iniciar sesion:

Antes de crear accesos, soporte puede validar la URL y la carpeta instalada sin
tocar el escritorio ni registrar tareas:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_hospital_startup_shortcut.ps1 -Url http://IP-DEL-SERVIDOR:8000 -WhatIfOnly
```

La salida de `-WhatIfOnly` usa marcadores como `%PROJECT_ROOT%`,
`%USERPROFILE%` y `[ruta-local]` para poder compartirla con soporte sin exponer
carpetas reales del servidor.

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_hospital_startup_shortcut.ps1 -InstallStartupTask
```

## Respaldos Automaticos

El instalador debe registrar dos tareas de Windows si se ejecuta con permisos de
administrador:

- `SistemaCajaHospitalaria-BackupWorker`: worker continuo para procesar
  respaldos solicitados desde la pantalla **Respaldos**.
- `SistemaCajaHospitalaria-DailyBackup`: respaldo local diario a la hora
  configurada.

Si el instalador no pudo registrar tareas por permisos, el tecnico puede hacerlo
despues con:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -WhatIfOnly
```

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting
```

El modo `-WhatIfOnly` no registra ni elimina tareas. Su salida usa nombres
seguros como `%PROJECT_ROOT%` y `[php-configurado]` para poder compartir la
captura con soporte sin exponer rutas locales del servidor.
Tambien valida que PHP exista antes de dejar una tarea programada que podria
fallar fuera del horario de caja.

Si no hay permisos de administrador, soporte puede validar el arranque de
backups para el usuario actual sin cambiar el registro ni iniciar procesos:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -WhatIfOnly
```

Ese modo valida hora y PHP sin crear archivo Startup, sin cambiar registro y sin
iniciar worker. Para revisar estado sin exponer rutas locales:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status
```

Luego debe crear un respaldo manual desde la UI y confirmar que cambia de
**Pendiente** a **Protegido**.

## Validacion Inicial

Despues de instalar:

1. Iniciar sesion como administrador real.
2. Configurar datos del hospital y recibo.
3. Crear usuarios reales.
4. Abrir caja.
5. Crear factura de prueba autorizada.
6. Cobrar.
7. Imprimir recibo institucional.
8. Reimprimir desde historial.
9. Revisar reporte diario.
10. Crear respaldo manual y verificar SHA256.
11. Cerrar caja.
12. Reiniciar Windows y repetir login desde servidor y cliente LAN.

## Cierre Final Antes De Operar

No declare la instalacion lista para produccion hasta completar cuatro
evidencias reales:

- `qa\LAN_CLIENT_VALIDATION_PROOF.md`: una segunda computadora abre el sistema
  por IP o nombre LAN.
- `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`: la impresora institucional imprime
  muestras fisicas media carta, carta, A5, 80mm, 58mm y reimpresion.
- `qa\FINAL_RESTORE_PROOF.md`: un respaldo restaura correctamente en una base
  descartable, nunca sobre la base activa.
- `qa\FINAL_CONCURRENCY_PROOF.md`: las pruebas de doble accion contra entorno
  descartable no duplican caja, factura ni pago.

La prueba de concurrencia es intencionalmente mutante: crea caja, facturas y
pagos de validacion. Solo debe ejecutarse contra una base descartable o snapshot
preparado por soporte. Use una cuenta temporal, no escriba credenciales dentro
de la URL y conserve el archivo `qa\FINAL_CONCURRENCY_PROOF.md` como evidencia.
El script solo debe escribir evidencia Markdown dentro de `qa\`; si soporte
configura otra ruta, debe corregirla antes de ejecutar la prueba.

Para revisar si las plantillas de evidencia estan disponibles sin reemplazar
archivos existentes:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1 -WhatIfOnly
```

El comando de cierre debe seguir reportando `PRODUCTION_CANDIDATE` hasta que
esas cuatro evidencias existan y el preflight pase sin omisiones:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://IP-DEL-SERVIDOR:8000
```

El reporte de cierre se guarda en `qa\FINAL_PRODUCTION_HANDOFF_RESULT.md`.
Si soporte usa `-ReportPath`, debe ser un archivo `.md` dentro de `qa\`; el
script rechaza rutas fuera de esa carpeta antes de ejecutar el preflight.

Para crear el borrador inicial de la prueba LAN desde la segunda computadora:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://IP-DEL-SERVIDOR:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -WhatIfOnly
```

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://IP-DEL-SERVIDOR:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

Ese script no reemplaza un archivo existente por accidente. Use `-Force` solo
si el responsable tecnico decide regenerar un borrador incompleto y ya guardo
la evidencia anterior que corresponda.
La ruta de `-EvidencePath` debe ser un archivo `.md` dentro de `qa\`; el script
rechaza rutas fuera de esa carpeta antes de consultar la red o escribir el
borrador.

## Soporte

Si el sistema no abre:

1. Espere dos minutos.
2. Use el acceso directo nuevamente. El acceso directo intentara abrir el
   sistema y, si no responde, ejecutara la reparacion segura automaticamente.
3. Si soporte necesita levantar servicios manualmente desde la carpeta del
   sistema, primero valide que el script detecta el modo correcto sin tocar
   contenedores:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start_hospital_services.ps1 -WhatIfOnly
```

4. Si la validacion indica los servicios esperados, ejecute:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start_hospital_services.ps1
```

5. Si soporte necesita repetir la reparacion manualmente, ejecute:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -WhatIfOnly
```

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -BaseUrl http://127.0.0.1:8000
```

6. Si sigue fallando, envie `qa\LOCAL_REPAIR_DIAGNOSTIC.md` al responsable tecnico.
7. No borre carpetas, volumenes Docker, archivos `.env` ni archivos de base de datos.

La reparacion segura solo revisa servicios, levanta contenedores, espera el backend,
abre el navegador si responde y genera diagnostico. No reinicia datos, no ejecuta
seeders y no restaura backups automaticamente.
Tambien advierte si `APP_URL` sigue en `localhost` o `127.0.0.1`, porque esa
configuracion impide validar clientes LAN.

## Paquete Seguro Para Soporte

Cuando el responsable tecnico necesite mas evidencia, genere un paquete seguro:

Para validar primero sin crear carpeta ni copiar logs:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\collect_support_packet.ps1 -WhatIfOnly
```

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\collect_support_packet.ps1 -RunRepairDiagnostic -SkipDockerStart
```

El paquete queda en `qa\support-packets\`. Incluye manifiesto, diagnostico y
extractos recortados de logs. No agrega `.env`, respaldos SQL, passwords,
tokens, rutas locales reales del servidor ni carpetas completas de datos. Si el
navegador abre, agregue tambien el resumen
seguro desde **Ayuda > Preparar resumen**.
