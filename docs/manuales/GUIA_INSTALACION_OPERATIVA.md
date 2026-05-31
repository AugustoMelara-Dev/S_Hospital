# Guia De Instalacion Operativa

Esta guia ayuda a dejar el sistema listo en una computadora servidor Windows.

## Antes De Instalar

Confirme:

- La computadora sera el servidor local.
- Hay energia estable.
- Docker esta instalado si se usara Docker Compose.
- La red local funciona.
- La impresora esta instalada.
- Hay respaldo si se esta actualizando una instalacion existente.

No borre carpetas de datos ni volumenes de base de datos.

## Instalar

1. Abra PowerShell o Explorador en la carpeta del sistema.
2. Ejecute `setup.bat`.
3. Espere a que los servicios levanten.
4. Revise que el acceso directo **Abrir Sistema de Caja Hospitalaria** exista en el escritorio.

El instalador no debe cargar datos temporales en produccion.
El instalador debe aplicar migraciones seguras sin borrar datos, sin ejecutar
`migrate:fresh` y sin correr seeders de demostracion. Tambien debe dejar
`APP_VERSION` configurado para que el diagnostico identifique la version
instalada.

## Abrir El Sistema

Servidor:

```text
http://127.0.0.1:8000
```

Clientes de red:

```text
http://IP-DEL-SERVIDOR:8000
```

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
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting
```

Luego debe crear un respaldo manual desde la UI y confirmar que cambia de
**Pendiente** a **Protegido**.

## Validacion Inicial

Despues de instalar:

1. Inicie sesion.
2. Configure hospital y recibo.
3. Abra caja.
4. Cree una factura de prueba autorizada.
5. Cobre.
6. Imprima.
7. Reimprima.
8. Cree respaldo.
9. Cierre caja.

## Cierre Final Antes De Operar

No declare la instalacion lista para produccion hasta completar cuatro
evidencias reales:

- `qa\LAN_CLIENT_VALIDATION_PROOF.md`: una segunda computadora abre el sistema
  por IP o nombre LAN.
- `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`: la impresora institucional imprime
  muestras fisicas media carta, carta, A5 y reimpresion.
- `qa\FINAL_RESTORE_PROOF.md`: un respaldo restaura correctamente en una base
  descartable, nunca sobre la base activa.
- `qa\FINAL_CONCURRENCY_PROOF.md`: las pruebas de doble accion contra entorno
  descartable no duplican caja, factura ni pago.

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

## Soporte

Si el sistema no abre:

1. Espere dos minutos.
2. Use el acceso directo nuevamente. El acceso directo intentara abrir el
   sistema y, si no responde, ejecutara la reparacion segura automaticamente.
3. Si soporte necesita levantar servicios manualmente desde la carpeta del
   sistema, ejecute:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start_hospital_services.ps1
```

4. Si soporte necesita repetir la reparacion manualmente, ejecute:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -WhatIfOnly
```

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -BaseUrl http://127.0.0.1:8000
```

5. Si sigue fallando, envie `qa\LOCAL_REPAIR_DIAGNOSTIC.md` al responsable tecnico.
6. No borre carpetas, volumenes Docker, archivos `.env` ni archivos de base de datos.

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
extractos recortados de logs. No agrega `.env`, respaldos SQL, passwords, tokens
ni carpetas completas de datos. Si el navegador abre, agregue tambien el resumen
seguro desde **Ayuda > Preparar resumen**.
