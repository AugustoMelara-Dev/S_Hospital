# Restore validation - operational hardening

## Scope

- Date/time: 2026-05-31 00:37 America/Tegucigalpa
- Environment: local Docker Compose development stack
- Source database: hospital_billing
- Disposable restore database: hospital_restore_validation_ops_test
- Method: created a fresh application backup, dropped/recreated only the disposable restore database, imported the backup, and verified core table counts.
- Production claim: not production-ready evidence for the final hospital server. This confirms the local restore path only.

## Result

```json
{
  "status": "VALIDATED",
  "restore_database": "hospital_restore_validation_ops_test",
  "backup_file": "/var/www/html/storage/app/private/backups/hospital-backup-20260531-003725-coaw1pta.sql",
  "backup_sha256": "654ab757b7c42582c61bb817aaff607e0bb64c1a06eeb13dec32d7664c3065cf",
  "backup_size_bytes": 108616,
  "counts": {
    "migrations": 34,
    "users": 3,
    "services": 122,
    "invoices": 8,
    "payments": 8,
    "backup_logs": 3
  }
}
```

## Notes

- The active database name was not used as restore target.
- The application database user could not create the disposable database; the local Compose root user was used inside the container only for create/drop/import of the disposable database.
- WSL `bash` was unavailable on the Windows host, so the guarded restore flow was executed inside Docker containers.
