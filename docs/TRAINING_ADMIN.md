# Guia rapida para administrador

## Inicio de servidor

1. Confirmar que el servidor usa la IP LAN final.
2. Validar `/up`, `/login` y `/verify-email` desde el servidor.
3. Entrar como admin y revisar **Backups**.
4. Confirmar que `APP_ENV=production`, `APP_DEBUG=false`, MySQL/MariaDB y dump tool aparezcan correctos.

## Backups

1. Confirmar tareas Windows:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status
```

2. Si faltan tareas, instalar desde PowerShell elevado:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
```

3. Crear backup manual desde UI.
4. Confirmar que cambie de `pending` a `success`, con checksum y tamano.

## Catalogo y fiscal

1. Editar servicios solo desde **Catalogo**.
2. No cambiar precios para corregir facturas historicas; las facturas usan snapshots.
3. Configurar CAI/rango fiscal antes de operar con datos reales.
4. No ejecutar seeders de validacion local en servidor real.

## Auditoria y control interno

1. Revisar **Reportes > Auditoria** al cierre del dia.
2. Confirmar anulaciones, reimpresiones, diferencias de caja, reversos de pago y cambios fiscales.
3. Asignar `auditor` solo a usuarios de consulta; no deben facturar ni operar caja.
4. Asignar `soporte_tecnico` solo para diagnostico tecnico; no debe tener permisos de caja ni backups.
5. Si un cajero se equivoca en un cobro, usar reversion de pago con motivo antes de cualquier anulacion de factura.

## Validacion final

1. Completar pruebas LAN desde segunda PC.
2. Completar prueba fisica de impresora media carta/carta/A5/80mm/58mm.
3. Ejecutar restore en base descartable.
4. Ejecutar concurrencia en entorno descartable.
5. Correr preflight sin bypass:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://IP_DEL_SERVIDOR
```

## Capacitacion sin datos reales

1. Preferir un entorno local de capacitacion o una base descartable para entrenamiento.
2. No crear pacientes, facturas ni pagos de practica en la base real.
3. No ejecutar seeders de desarrollo ni resets destructivos en el servidor real.
4. Antes de cualquier simulacro autorizado en servidor final, crear respaldo manual y confirmar que quede completado.
5. Documentar fecha, responsable y usuarios usados durante la capacitacion.
