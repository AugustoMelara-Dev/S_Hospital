# Production Audit Baseline - 2026-06-18

Goal: move S_Hospital toward production readiness with faster tests, broader QA, configurable module access and final hardening without touching real production data.

## Initial State

- Branch/worktree: dirty working tree with broad prior hardening work already present. This phase must not revert unrelated files.
- Production compose project: `shospital_offlinetest`.
- Production URL under validation: `http://192.168.1.7:8081`.
- Env file used by production validation: `C:\tmp\s_hospital_offlinetest.env`.
- Containers observed healthy: backend, mysql, nginx, queue-worker, scheduler, soketi.

## Current Production Gate

Authoritative elevated preflight log:

- `qa/ELEVATED_PREFLIGHT_FINAL_ONE_BLOCKER_8081.log`

Validated:

- APP_ENV production and APP_DEBUG false.
- LAN URL is not localhost.
- MySQL/MariaDB connection.
- Docker backend, migrations and dump binary.
- Backup worker and scheduled backup wrappers.
- Windows scheduled tasks:
  - `SistemaCajaHospitalaria-BackupWorker`: Ready, lastResult=0.
  - `SistemaCajaHospitalaria-DailyBackup`: Ready, lastResult=0.
- Routes `/up`, `/login`, `/verify-email`.
- Second-client LAN proof.
- Restore proof.
- Concurrency proof.
- Concurrency under load proof.

Remaining blocker:

- Physical receipt print validation for real paper media carta/carta/A5.
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` documents that this server only has virtual printers: `Microsoft Print to PDF` and `OneNote (Desktop)`.

## Safety Rules For This Goal

- Do not run `migrate:fresh`, `db:wipe`, `migrate:reset`, `DROP DATABASE`, Docker volume deletion, or filesystem deletion against production data.
- Test databases must be disposable and explicitly named as test/golden databases.
- Production readiness must not mark physical printer validation complete until there is paper evidence from a real printer.

