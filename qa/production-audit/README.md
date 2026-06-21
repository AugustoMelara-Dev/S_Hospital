# Production Audit Baseline - current

Goal: move S_Hospital toward production readiness with faster tests, broader QA, configurable module access and final hardening without touching real production data.

## Initial State

- Branch/worktree: dirty working tree with broad prior hardening work already present. This phase must not revert unrelated files.
- Production compose project: `shospital_offlinetest`.
- Production URL under validation: `http://192.168.1.2:8081`.
- Env file used by production validation: `C:\tmp\s_hospital_offlinetest.env`.
- Containers observed healthy: backend, mysql, nginx, queue-worker, scheduler, soketi.

## Current Production Gate

Authoritative current summary:

- `qa/FINAL_BLOCKED_AUDIT_CURRENT.md`
- `qa/FINAL_PRODUCTION_HANDOFF_RESULT_8081_CURRENT.md`

Validated:

- APP_ENV production and APP_DEBUG false.
- LAN URL is not localhost and current app env points to `192.168.1.2`.
- MySQL/MariaDB connection.
- Docker backend, migrations and dump binary.
- Backup worker and scheduled backup wrappers.
- Windows scheduled tasks have elevated proof as `SYSTEM`; non-elevated checks may warn on access.
- Routes `/up`, `/login`, `/verify-email`.
- Restore proof.
- Concurrency proof.
- Concurrency under load proof.
- Dependency audit proof: `dependency-security-audit-2026-06-20.md`.
- Backend MySQL/MariaDB golden DB proof: `golden-db-runner-proof.md`.
- Release E2E SQLite golden proof: `release-e2e-golden-sqlite-proof-2026-06-20.md`.
- UI/a11y/buttons smoke proof: `button-smoke-report.json`.

Remaining blocker:

- Repeat second-client LAN proof against final `http://192.168.1.2:8081`.
- Physical receipt print validation for real paper media carta/carta/A5, including browser headers/footers evidence.

## Safety Rules For This Goal

- Do not run `migrate:fresh`, `db:wipe`, `migrate:reset`, `DROP DATABASE`, Docker volume deletion, or filesystem deletion against production data.
- Test databases must be disposable and explicitly named as test/golden databases.
- Production readiness must not mark physical printer validation complete until there is paper evidence from a real printer.
