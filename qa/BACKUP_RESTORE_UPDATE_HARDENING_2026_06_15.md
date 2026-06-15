# Backup/restore/update hardening evidence - 2026-06-15

- Branch: hardening/global-release-candidate-2026-06-15
- Mode: disposable SQLite backup/restore proof plus Windows guarded preflight checks.
- Real hospital data touched: no.
- Destructive commands used: no.
- migrate:fresh/drop/reset used: no.

## Backup real on disposable database

- Source database: C:\tmp\s-hospital-visual-rc.sqlite
- Backup filename: hospital-backup-20260614-233453-qcvhz7ic.sql
- Backup path: backend\storage\app\private\backups\hospital-backup-20260614-233453-qcvhz7ic.sql
- Size bytes: 720896
- SHA256: 00EF65B324F78CD54186CF200D6D52633F17CB56E82B873E5F0307F85D726AFB
- Backup command: php artisan hospital:backup --type=manual
- Result: backup file exists, has non-zero size and SHA256.

## Disposable restore proof

- Restore target: C:\tmp\s-hospital-restore-proof.sqlite
- Restore method: copied backup file to disposable SQLite database and opened it with PDO.
- Critical counts source: { "migrations": 54, "users": 3, "services": 122, "invoices": 0, "payments": 0, "backup_logs": 1 }
- Critical counts restored: { "migrations": 54, "users": 3, "services": 122, "invoices": 0, "payments": 0, "backup_logs": 1 }
- Result: source and restored counts match for migrations, users, services, invoices, payments and backup_logs.

## Safe Windows checks executed

- scripts\restore_hospital_windows.ps1 -SelfTest: passed; no database or backup touched.
- scripts\install_backup_tasks_windows.ps1 -WhatIfOnly: passed; no scheduled tasks registered or modified.
- scripts\run_scheduled_backup.cmd --check: passed; no backup created in check mode.
- scripts\run_backup_worker.cmd --check: passed; no worker started in check mode.
- scripts\update_release_preflight.ps1 -ExpectedCurrentCommit <HEAD> -ReportPath qa\UPDATE_PREFLIGHT_HARDENING_2026_06_15.md: passed with one expected source-worktree warning about missing real .env.

## Operational conclusion

Backup creation, checksum verification, disposable restore comparison and guarded update preflight are evidenced without touching real hospital data. MySQL disposable restore remains the required production-style validation when a real MySQL/MariaDB server is available.
