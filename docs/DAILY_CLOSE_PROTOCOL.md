# Protocolo de cierre diario

## Caja

1. Cada cajero cierra su caja al final del turno.
2. Supervisor revisa diferencias y notas.
3. No borrar facturas; las correcciones van por anulacion autorizada.

## Reportes

1. Abrir **Reportes**.
2. Revisar rango del dia.
3. Comparar total cobrado por metodo contra caja fisica.
4. Revisar anulaciones y reimpresiones del dia.
5. Exportar CSV solo con permiso autorizado.

## Backup

1. Abrir **Backups**.
2. Confirmar ultimo backup exitoso del dia.
3. Si no existe, crear backup manual.
4. Esperar `success`, checksum y tamano mayor a cero.
5. Si queda `pending`, revisar worker:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status
Start-ScheduledTask -TaskName HospitalBillingOS-BackupWorker
```

## Evidencia

1. Guardar CSV diario si administracion lo requiere.
2. Registrar cualquier diferencia de caja.
3. No declarar cierre correcto si backup queda `pending` o `failed`.
