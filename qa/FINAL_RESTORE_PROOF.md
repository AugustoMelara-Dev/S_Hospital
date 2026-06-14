# Final restore proof

Estado actual: `NO VERIFICADO`
Fase: `G - prueba fisica LAN/offline real`
Decision actual: `READY_FOR_REAL_LAN_OFFLINE_INSTALLATION_TEST`

Este archivo documenta la restauracion final contra una base descartable en el servidor final o hardware equivalente aprobado. No restaurar sobre la base activa del hospital.

## Environment

- Date/time: NO VERIFICADO
- Responsible person: NO VERIFICADO
- Source database: NO VERIFICADO
- Disposable restore database: NO VERIFICADO
- Backup file (relative path or filename only, no absolute server path): NO VERIFICADO
- Backup SHA256: NO VERIFICADO
- Backup size bytes: NO VERIFICADO
- Evidence/capture reference: NO VERIFICADO
- Final conclusion: NO VERIFICADO

## Required checks

- [ ] Backup manual generated from UI. Result/evidence: NO VERIFICADO
- [ ] Backup log reached `success`. Result/evidence: NO VERIFICADO
- [ ] Backup file exists and has SHA256. Result/evidence: NO VERIFICADO
- [ ] Disposable restore database is not the active database. Result/evidence: NO VERIFICADO
- [ ] Restore imports without SQL error. Result/evidence: NO VERIFICADO
- [ ] `php artisan migrate:status` passes against restored database. Result/evidence: NO VERIFICADO
- [ ] Migration table has rows. Result/evidence: NO VERIFICADO
- [ ] Core counts captured. Result/evidence: NO VERIFICADO
- [ ] Basic restored login or route smoke validated. Result/evidence: NO VERIFICADO

## Commands

```powershell
Get-FileHash RUTA_DEL_BACKUP -Algorithm SHA256

powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 `
  -UseExistingEnv `
  -TargetDatabase hospital_restore_validation_test `
  -BackupFile RUTA_DEL_BACKUP
```

## Core counts

- users: NO VERIFICADO
- roles: NO VERIFICADO
- permissions: NO VERIFICADO
- services: NO VERIFICADO
- invoices: NO VERIFICADO
- payments: NO VERIFICADO
- cash_register_sessions: NO VERIFICADO
- backup_logs: NO VERIFICADO

## Evidence

- Notes: Pendiente de backup UI y restore en base descartable.
