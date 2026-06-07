# Guia rapida para administrador

## Inicio de servidor

1. Confirmar que el servidor usa la IP LAN final.
2. Validar que la pantalla de inicio abra desde el servidor y desde una computadora cliente.
3. Entrar como admin y revisar **Backups**.
4. Confirmar que el panel muestre sistema en produccion, base de datos lista y respaldos disponibles.

## Backups

1. Confirmar tareas Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status
```

2. Si faltan tareas, instalar desde PowerShell elevado:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
```

3. Crear respaldo manual desde UI.
4. Confirmar que el respaldo cambie de **Pendiente** a **Protegido**. Si aparece **Error**, preparar resumen seguro desde Ayuda y avisar a soporte local.

## Catalogo y fiscal

1. Editar servicios solo desde **Catalogo**.
2. No cambiar precios para corregir facturas historicas; las facturas usan snapshots.
3. Configurar CAI/rango fiscal antes de operar con datos reales.
4. No ejecutar seeders de validacion local en servidor real.

## Validacion final

1. Completar pruebas LAN desde segunda PC.
2. Completar prueba fisica de impresora media carta/carta/A5.
3. Ejecutar restore en base descartable.
4. Ejecutar concurrencia en entorno descartable.
5. Correr preflight sin bypass:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl https://IP_DEL_SERVIDOR
```
