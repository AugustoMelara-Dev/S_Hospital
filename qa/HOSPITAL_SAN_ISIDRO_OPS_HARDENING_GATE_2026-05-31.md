# Hospital San Isidro - Ops hardening gate 2026-05-31

## Decision

LOCAL OPS HARDENING VALIDATED. PRODUCTION_READY: NO.

This gate covers the operational support hardening front: safe installer/repair, support center, sanitized diagnostics, client issue logging, idempotent invoice/payment submits, local backup/restore validation and browser smoke evidence.

It does not replace final hospital-server proof. A new production handoff still requires the real server PC, real LAN client, real printer, Windows scheduled tasks and final environment variables.

## Current evidence

- Current commit reviewed: `1483d3d`.
- Working tree after the committed gate contains unrelated local edits in catalog/invoice/settings files that were not staged by this agent.
- Running stack: Docker backend, frontend and MariaDB active; MariaDB healthy.
- Direct SPA route proof: `http://127.0.0.1:8000/support` returned 200; `http://127.0.0.1:8000/about` returned 200.
- Support screenshot: `qa/screenshots/ops-hardening-audit-2026-05-31/support-center-after-status-summary.png`.
- Support console log: `qa/screenshots/ops-hardening-audit-2026-05-31/support-center-after-status-summary-console.json` with `[]`.
- Safe training screenshot: `qa/screenshots/ops-hardening-audit-2026-05-31/support-center-training-safe-after.png`.
- Safe training console/network evidence: `qa/screenshots/ops-hardening-audit-2026-05-31/support-center-training-safe-console.json` with only 200 responses for setup/status endpoints and no browser console errors.
- Visual smoke report: `qa/screenshots/phase-12-visual-smoke/visual-smoke-report.json`, `consoleIssueCount: 0`, `blockerCount: 0`.
- Local restore proof: `qa/ops-hardening-restore-validation-2026-05-31.md`.

## Automated gates

| Gate | Result | Evidence |
|---|---:|---|
| `docker compose exec backend composer validate --no-check-publish` | PASS | `composer.json is valid` |
| `docker compose exec backend vendor/bin/pint --test` | PASS | 180 files |
| `docker compose exec backend php artisan test --colors=never` | PASS | 178 tests, 1104 assertions |
| `npm.cmd run check:branding` | PASS | no branding findings |
| `npm.cmd run typecheck` | PASS | `tsc --noEmit` |
| `npm.cmd run lint` | PASS | ESLint completed |
| `npm.cmd test` | PASS | 6 files, 41 tests |
| `npm.cmd run build` | PASS with warning | Vite chunk warning for main bundle over 500 kB |
| `npm.cmd run e2e` | PASS | 2 Playwright tests |
| `scripts/validate_installer_safety.ps1` | PASS | no destructive installer findings |
| `scripts/repair_hospital_system.ps1 -WhatIf` | PASS | non-destructive repair path prints intended actions |
| Local restore into disposable DB | PASS | `hospital_restore_validation_ops_test`, backup SHA256 recorded |

## Production preflight result

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://127.0.0.1:8000 -AllowMissingPhysicalProof
```

Result: FAIL as expected for this workstation.

Blocking issues reported:

- `APP_ENV` is `local`, not `production`.
- `APP_DEBUG` is `true`, not `false`.
- `APP_URL` is configured for `http://192.168.1.3:8000`, not the tested URL.
- The tested URL is localhost, not a final LAN IP or local domain.
- Windows scheduled task `SistemaCajaHospitalaria-BackupWorker` is not installed here.
- Windows scheduled task `SistemaCajaHospitalaria-DailyBackup` is not installed here.
- Physical LAN/printer proof was bypassed with `-AllowMissingPhysicalProof`.

Positive checks in the same preflight:

- DB connection is MySQL/MariaDB.
- Queue connection is `database`.
- Frontend build and assets exist.
- PHP, MySQL client and dump tool are available.
- Backup directory is writable.
- `/up`, `/login` and `/verify-email` responded 200.

## Requirement matrix

| Requirement | Current status | Evidence |
|---|---|---|
| Support/help section for staff | Implemented | `/support`, support screenshot, E2E support smoke |
| Normal-user readable status | Implemented | `/api/system/status-summary`, App tests, screenshot |
| Advanced diagnostics restricted | Implemented | `/api/system/status`, permission tests |
| No secrets/raw env in normal diagnostics | Implemented | `SystemStatusTest`, client log tests |
| Human error messages and support logging | Implemented | `errorCatalog`, `client_error_logs`, `ClientErrorLogTest` |
| Safe installer/no destructive setup | Implemented | installer safety script PASS |
| Safe repair script | Implemented | repair WhatIf PASS |
| No duplicate invoice/payment on retry | Implemented | idempotency tests in invoice/payment suites |
| Training by role | Implemented at product/docs level | Support role checklists, manuals and training docs |
| Safe practice guidance | Implemented | `/support` playbook, training manuals and checklist require demo/disposable data or backup before supervised simulation |
| Local backup creation | Verified | `hospital:backup` and restore proof |
| Restore validation | Verified locally only | disposable DB proof |
| Browser smoke | Verified locally | Playwright E2E and visual smoke report |
| Final LAN client proof | Pending physical field validation | Must rerun on hospital LAN |
| Final printer proof | Pending physical field validation | Must rerun with real printer/paper |
| Final Windows startup/backup tasks | Pending field validation | Missing on this workstation |
| Production environment settings | Pending final server | preflight blockers above |

## Risks carried forward

- This machine is not the final hospital server, so production readiness remains unproven.
- The local restore proof confirms recovery mechanics, but final restore must be repeated with final backup paths and final server configuration.
- Physical printer behavior cannot be inferred from screenshots or PDFs.
- The main frontend bundle still emits a Vite size warning; not a blocker for LAN use, but worth monitoring if more modules are added.
- A separate catalog edit in `frontend/src/features/catalog/components/ServiceSheet.tsx` exists outside this gate and should be reviewed independently before release.

## Decision

Approved for local operational hardening progress.

Do not call the system `PRODUCTION_READY` until final physical handoff passes without bypass flags on the installed Hospital San Isidro server.
