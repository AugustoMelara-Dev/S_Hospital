# Final restore proof

- Date/time: 2026-06-03 04:55 America/Tegucigalpa
- Responsible person: Codex local validation operator
- Source database: `hospital_billing` Docker/MariaDB development database
- Disposable restore database: `hospital_restore_validation_20260603`
- Backup file: `storage/app/private/backups/hospital-backup-20260603-104616-2zoj9qzt.sql`
- Backup SHA256: `56db3aa325eb31c3fcd7eaf07f40cf2c83571ea3b72f2b67b4e3f5fee9fbee57`
- Backup size bytes: `92050`
- Evidence/capture reference: `qa/FINAL_RESTORE_PROOF_2026_06_03.md`
- Final conclusion: Restore completed successfully into the disposable validation database; the active database was not overwritten.

## Required checks

- [x] Disposable restore database. Result/evidence: restore target was `hospital_restore_validation_20260603`, different from active database `hospital_billing`.
- [x] Backup file. Result/evidence: backup `hospital-backup-20260603-104616-2zoj9qzt.sql` was used with SHA256 `56db3aa325eb31c3fcd7eaf07f40cf2c83571ea3b72f2b67b4e3f5fee9fbee57`.
- [x] Restore imports. Result/evidence: MariaDB import into the disposable database exited successfully.
- [x] Migration table. Result/evidence: restored schema included the Laravel migrations table.
- [x] Services table. Result/evidence: restored `services` count was 122.
- [x] Core counts. Result/evidence: users=3, roles=3, permissions=31, invoices=2, payments=2, cash_register_sessions=1, backup_logs=8.

## Scope

This proof validates the current Docker/MariaDB development environment only. Final-server restore validation on the installed hospital PC is still required.
