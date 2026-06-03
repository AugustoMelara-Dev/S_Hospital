# Final restore proof

- Date/time: 2026-06-03 04:55 America/Tegucigalpa
- Source backup: `storage/app/private/backups/hospital-backup-20260603-104616-2zoj9qzt.sql`
- Source backup SHA256: `56db3aa325eb31c3fcd7eaf07f40cf2c83571ea3b72f2b67b4e3f5fee9fbee57`
- Disposable restore database: `hospital_restore_validation_20260603`
- Active database: `hospital_billing`
- Result: backup restored successfully into the disposable database, not the active database.

## Restored counts

- users: 3
- roles: 3
- permissions: 31
- services: 122
- invoices: 2
- payments: 2
- cash_register_sessions: 1
- backup_logs: 8

## Safety notes

- The restore target name contains `restore` and `validation`.
- The active database was not dropped or overwritten.
- This proof validates a Docker/MariaDB development environment only. Final server restore validation is still required before declaring production ready.
