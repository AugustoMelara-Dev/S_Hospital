# Recovery certification

Copiar este archivo como `qa/RECOVERY_CERTIFICATION.md` o generarlo con:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\run_release_e2e_mariadb.ps1 -RecoveryDrill
```

El comando debe usar un proyecto Docker aislado, dos bases desechables distintas
y nunca la base configurada del hospital. No escribir claves, contraseñas ni
rutas absolutas.

- status: PENDING
- completed_at_utc: PENDING
- compose_project: s_hospital_recovery_<id>
- source_database: hospital_recovery_source_<id>
- target_database: hospital_recovery_target_<id>
- backup_identifier: PENDING
- backup_checksum_sha256: PENDING
- critical_tables_validated: PENDING/10
- preventive_backup_status: PENDING
- rollback_succeeded: PENDING
- recovery_succeeded: PENDING
- secrets_or_absolute_paths_included: false
