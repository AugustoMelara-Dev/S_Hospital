# S_Hospital V1.1 - Disposable Backup/Restore Field Evidence

Date: 2026-06-25 America/Tegucigalpa
Mode: local disposable Docker/MariaDB validation
Source database: `s_hospital_test_field_src_20260625213129`
Restore database: `s_hospital_restore_validation_20260625213129`
Production database touched: NO
Real patient data used: NO
Backup file: `storage/app/private/backups/hospital-backup-20260625-213256-lprlqd1y.sql.enc`
Backup SHA256: `1d4ce6f7e113add9aad6edc241b476190dffa81615e1e0ccb9d0d1238f0fc97b`
Backup size bytes: 230084

## Result

PASS - backup was generated through `php artisan hospital:backup --type=manual`, decrypted with `hospital:decrypt-backup`, imported into a separate disposable database, and source/restore counts matched for core business tables.

Audit log note: source audit logs may be one row higher because the backup success audit entry is written after the SQL dump is produced. Observed audit delta: 1.

## Counts

| Table | Source | Restore |
| --- | ---: | ---: |
| users | 3 | 3 |
| roles | 5 | 5 |
| services | 122 | 122 |
| invoices | 0 | 0 |
| invoice_items | 0 | 0 |
| payments | 0 | 0 |
| cash_register_sessions | 0 | 0 |
| cash_movements | 0 | 0 |
| institutional_receipts | 0 | 0 |
| audit_logs | 91 | 90 |
| fiscal_sequences | 1 | 1 |
| fiscal_settings | 1 | 1 |

## Limits

This proves a local disposable backup/restore path in Docker/MariaDB. It does not replace the final hospital-site restore proof that must be run by the operator in the real deployment environment.
