# Safe update preflight evidence

- Generated at: 2026-06-14 23:35:36 -06:00
- Project root: %PROJECT_ROOT%
- Expected current commit: 35c28856ffa4706e819b24d51eb869e6be899534
- Expected target commit:
- Result: PASSED

## Passes
- Git HEAD detected: 35c28856ffa4706e819b24d51eb869e6be899534
- Git status is clean
- Real .env files are not tracked by Git
- Backend environment template exists: backend\.env.example
- Laravel storage root exists: backend\storage
- Laravel storage app directory exists: backend\storage\app
- Private storage directory exists: backend\storage\app\private
- Public storage directory exists: backend\storage\app\public
- Log directory exists: backend\storage\logs
- Bootstrap cache directory exists: backend\bootstrap\cache
- Backup directory exists and must be preserved
- Safe update manual exists: docs\manuales\MANUAL_ACTUALIZACION_SEGURA.md
- Safe update checklist exists: docs\manuales\CHECKLIST_ACTUALIZACION_SEGURA.md
- Backup/restore manual exists: docs\BACKUP_RESTORE.md
- Institutional receipt validation guide exists: docs\INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md
- Restore self-test script exists: scripts\restore_hospital_windows.ps1
- Backup task installer exists: scripts\install_backup_tasks_windows.ps1
- Production preflight exists: scripts\production_readiness_preflight.ps1
- Update preflight exists: scripts\update_release_preflight.ps1
- Disposable MySQL restore validator exists: scripts\validate_restore_mysql.sh
- No destructive update pattern found in scripts\deploy_hospital_lan.ps1
- No destructive update pattern found in scripts\release_setup.bat
- No destructive update pattern found in scripts\start_hospital_services.ps1
- No destructive update pattern found in scripts\run_backup_worker.cmd
- No destructive update pattern found in scripts\run_scheduled_backup.cmd

## Warnings
- No real .env file found in project root or backend. This is acceptable in source worktrees, not in an installed server.

## Failures
- None

No database, storage or production data was modified by this preflight.
