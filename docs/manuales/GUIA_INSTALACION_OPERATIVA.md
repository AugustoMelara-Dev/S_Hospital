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

## Arranque Automatico

El script `scripts/install_hospital_startup_shortcut.ps1` crea el acceso directo. Si el tecnico lo autoriza, puede registrar una tarea al iniciar sesion:

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

## Soporte

Si el sistema no abre:

1. Espere dos minutos.
2. Use el acceso directo nuevamente.
3. Ejecute la reparacion segura:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -BaseUrl http://127.0.0.1:8000
```

4. Si sigue fallando, envie `qa\LOCAL_REPAIR_DIAGNOSTIC.md` al responsable tecnico.
5. No borre carpetas, volumenes Docker, archivos `.env` ni archivos de base de datos.

La reparacion segura solo revisa servicios, levanta contenedores, espera el backend,
abre el navegador si responde y genera diagnostico. No reinicia datos, no ejecuta
seeders y no restaura backups automaticamente.

## Paquete Seguro Para Soporte

Cuando el responsable tecnico necesite mas evidencia, genere un paquete seguro:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\collect_support_packet.ps1 -RunRepairDiagnostic -SkipDockerStart
```

El paquete queda en `qa\support-packets\`. Incluye manifiesto, diagnostico y
extractos recortados de logs. No agrega `.env`, respaldos SQL, passwords, tokens
ni carpetas completas de datos. Si el navegador abre, agregue tambien el resumen
seguro desde **Ayuda > Preparar resumen**.
