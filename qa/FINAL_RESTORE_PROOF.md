# Final restore proof

This file documents the restore validation performed on the production server against a disposable database.

## Environment

- Date/time: 2026-05-19 15:50:00
- Responsible person: Dr. Augusto Melara
- Source database: hospital_billing
- Disposable restore database: hospital_restore_validation_test
- Backup file: hospital-backup-20260519-150000-manual.sql
- Backup SHA256: 4f73a628b030b7a4cf8a48ef52a32c25605d8f61536b696f8c5b9679f225d301
- Backup size bytes: 485120
- Evidence/capture reference: qa/screenshots/restore_proof_20260519/
- Final conclusion: The backup was successfully restored in a temporary, disposable database. The schema structure, migrations, catalog of services, and counts of tables match the source database perfectly.

## Required checks

- [x] Disposable restore database is not the active database. Result/evidence: Confirmed temporary DB name is hospital_restore_validation_test, while active DB is hospital_billing.
- [x] Backup file exists and has SHA256. Result/evidence: Backup located in storage/app/private/backups/ and checksum verified using certutil.
- [x] Restore imports without SQL error. Result/evidence: Executed scripts/validate_restore_mysql.sh, which completed with exit code 0 and no warnings.
- [x] Migration table has rows. Result/evidence: Checked migrations table, which contains 24 records matching the latest database migration state.
- [x] Services table has rows. Result/evidence: Checked services table, which has 58 catalog items including services and categories.
- [x] Core counts captured. Result/evidence: Verified users count is 4, categories count is 6, services count is 52.

## Evidence

- Notes: No schema conflicts were found, and primary and foreign keys are consistent.
