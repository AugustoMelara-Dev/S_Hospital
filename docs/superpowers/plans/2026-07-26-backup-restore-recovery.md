# Backup and Restore Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make daily encrypted backups observable and provide a guarded local production-recovery assistant with preflight validation, preventive backup, maintenance mode, health checks, and rollback.

**Architecture:** Keep restore outside HTTP and outside the live application process. Extend the existing PowerShell restore helper into two explicit modes: safe disposable validation and guarded production recovery, with Docker/bare-metal adapters and a machine-readable evidence log.

**Tech Stack:** Laravel 12 console/actions, MySQL/MariaDB, Docker Compose, Windows PowerShell 5.1, encrypted `.sql.gz.enc` packages, PHPUnit, PowerShell self-tests.

## Global Constraints

- No restore endpoint is exposed by Laravel.
- Backup packages remain encrypted at rest and require a SHA-256 checksum.
- Secrets and absolute server paths never appear in shareable evidence.
- Production restore requires maintenance mode and no open cash sessions.
- A preventive backup must succeed before production is modified.
- A failed recovery keeps the application unavailable until rollback or explicit operator action succeeds.
- Every behavior change follows red-green-refactor and ends in a Conventional Commit.

---

### Task 1: Specify and test the guarded recovery state machine

**Files:**
- Create: `scripts/lib/recovery_contract.ps1`
- Create: `scripts/recovery_contract.test.ps1`
- Modify: `scripts/restore_hospital_windows.ps1`

**Interfaces:**
- Produces: `Get-RecoverySteps -Mode Validation|Production` returning ordered step names.
- Produces: `Test-ProductionRecoveryAllowed` returning `{ Allowed, Blockers }`.
- Consumed by: `restore_hospital_windows.ps1` and installer maintenance shortcut.

- [ ] **Step 1: Write failing contract tests**

Assert the production order exactly:

```powershell
@(
  'verify-package',
  'validate-disposable',
  'verify-no-open-cash',
  'create-preventive-backup',
  'enter-maintenance',
  'stop-writers',
  'restore-production',
  'run-migrations',
  'verify-health',
  'resume-writers',
  'leave-maintenance'
)
```

Assert blockers for missing checksum, failed disposable validation, open cash sessions, and failed preventive backup.

- [ ] **Step 2: Run self-tests and verify red**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\recovery_contract.test.ps1
```

Expected: fail because the contract module does not exist.

- [ ] **Step 3: Implement pure contract functions**

Functions accept plain objects and return plain objects; they must not call Docker, MySQL, or Laravel. This keeps state decisions independently testable.

- [ ] **Step 4: Integrate the ordered contract into the helper**

Keep current disposable validation behavior as the default. Add `-ProductionRecovery` only when all contract blockers are empty. Preserve rejection of deprecated `-ForceProductionRestore`.

- [ ] **Step 5: Run tests**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\recovery_contract.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 -SelfTest
```

Expected: both exit zero and touch no database.

- [ ] **Step 6: Commit**

```powershell
git add scripts/lib/recovery_contract.ps1 scripts/recovery_contract.test.ps1 scripts/restore_hospital_windows.ps1
git commit -m "test(backups): define guarded recovery contract"
```

### Task 2: Add runtime adapters for Docker and bare-metal Windows

**Files:**
- Create: `scripts/lib/recovery_runtime.ps1`
- Create: `scripts/recovery_runtime.test.ps1`
- Modify: `scripts/restore_hospital_windows.ps1`

**Interfaces:**
- Produces: `Resolve-RecoveryRuntime -ProjectRoot` with `Mode`, `ComposeFile`, `PhpPath`, `MySqlPath`.
- Produces: `Invoke-HospitalCommand`, `Enter-HospitalMaintenance`, `Exit-HospitalMaintenance`, `Stop-HospitalWriters`, `Start-HospitalWriters`.

- [ ] **Step 1: Write failing adapter-resolution tests**

Use temporary fixture directories and assert:

- Docker requires `docker-compose.prod.yml`, `.env`, and Docker Compose availability.
- Bare-metal requires `backend\artisan`, PHP, and MySQL client.
- Ambiguous or incomplete layouts return a blocker instead of guessing.

- [ ] **Step 2: Verify red**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\recovery_runtime.test.ps1
```

Expected: fail because runtime module does not exist.

- [ ] **Step 3: Implement command adapters**

Docker Laravel commands use:

```powershell
docker compose -f $ComposeFile --env-file $EnvFile exec -T backend php artisan @Arguments
```

Bare-metal uses:

```powershell
& $PhpPath (Join-Path $ProjectRoot 'backend\artisan') @Arguments
```

Writer processes are queue worker and scheduler. Database and web are stopped only at the replacement boundary, then restarted for verification.

- [ ] **Step 4: Verify adapter tests**

Run the test script and assert no external service is started; command execution is injected and recorded by a fake invoker.

- [ ] **Step 5: Commit**

```powershell
git add scripts/lib/recovery_runtime.ps1 scripts/recovery_runtime.test.ps1 scripts/restore_hospital_windows.ps1
git commit -m "feat(backups): add local recovery runtime adapters"
```

### Task 3: Validate backup in a disposable database before production

**Files:**
- Modify: `scripts/restore_hospital_windows.ps1`
- Modify: `backend/tests/Feature/Resilience/BackupRestoreRoundtripTest.php`
- Modify: `scripts/run_release_e2e_mariadb.test.ps1`

**Interfaces:**
- Consumes: encrypted backup path, checksum, encryption key from local environment.
- Produces: `RecoveryValidationResult` with critical table counts and `Valid=true|false`.

- [ ] **Step 1: Add failing validation assertions**

Require tables:

```text
users, roles, permissions, services, invoices, invoice_items,
payments, cash_register_sessions, cash_movements, backup_logs
```

Require the disposable database name to contain `test`, `restore`, `validation`, `disposable`, or `proof`.

- [ ] **Step 2: Run roundtrip tests**

Run:

```powershell
cd backend
php artisan test tests/Feature/Resilience/BackupRestoreRoundtripTest.php
cd ..
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\run_release_e2e_mariadb.test.ps1
```

Expected: new production-validation contract fails until the helper returns structured counts.

- [ ] **Step 3: Implement disposable validation**

Decrypt only to a unique `%TEMP%\hospital_restore_<guid>.sql`, import to the disposable database, query table/count checks, and delete plaintext in `finally`.

- [ ] **Step 4: Verify cleanup on success and failure**

Tests must inject an import failure and assert no plaintext `.sql` remains.

- [ ] **Step 5: Commit**

```powershell
git add scripts/restore_hospital_windows.ps1 scripts/run_release_e2e_mariadb.test.ps1 backend/tests/Feature/Resilience/BackupRestoreRoundtripTest.php
git commit -m "feat(backups): validate restore before production recovery"
```

### Task 4: Implement preventive backup, production replacement, and rollback

**Files:**
- Modify: `scripts/restore_hospital_windows.ps1`
- Create: `scripts/production_recovery.test.ps1`
- Modify: `backend/app/Console/Commands/BackupDatabaseCommand.php`
- Modify: `backend/tests/Feature/BackupWorkflowTest.php`

**Interfaces:**
- Consumes: successful validation result from Task 3.
- Produces: preventive backup log ID/checksum, recovery result, and rollback package reference.

- [ ] **Step 1: Write failing orchestration tests with a fake invoker**

Cover:

- open cash sessions block before preventive backup;
- preventive backup failure blocks maintenance;
- restore failure after replacement invokes rollback;
- health failure keeps maintenance active;
- success resumes writer services and exits maintenance.

- [ ] **Step 2: Verify red**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\production_recovery.test.ps1
```

Expected: fail because production orchestration is absent.

- [ ] **Step 3: Add a machine-readable backup command result**

Add `--json` to `hospital:backup`. On success emit only:

```json
{"status":"success","backup_log_id":1,"filename":"...sql.gz.enc","checksum_sha256":"..."}
```

Human output remains unchanged without `--json`. Never emit encryption keys or DB credentials.

- [ ] **Step 4: Implement the guarded orchestration**

Require the operator to type the active database name and `RESTAURAR` before replacement. Use the preventive package for automatic rollback. Do not use `DROP DATABASE` until maintenance is active and writers are stopped.

- [ ] **Step 5: Verify backend and PowerShell tests**

Run:

```powershell
cd backend
php artisan test --filter=BackupWorkflowTest
cd ..
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\production_recovery.test.ps1
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add scripts/restore_hospital_windows.ps1 scripts/production_recovery.test.ps1 backend/app/Console/Commands/BackupDatabaseCommand.php backend/tests/Feature/BackupWorkflowTest.php
git commit -m "feat(backups): add guarded production recovery and rollback"
```

### Task 5: Expose safe recovery readiness in the UI

**Files:**
- Modify: `frontend/src/features/backups/BackupsView.tsx`
- Modify: `frontend/src/features/backups/BackupsView.test.tsx`
- Create: `frontend/src/features/backups/components/RecoveryReadinessCard.tsx`
- Create: `frontend/src/features/backups/components/RecoveryReadinessCard.test.tsx`
- Modify: `docs/BACKUP_RESTORE.md`
- Modify: `docs/backup-restore-runbook.md`

**Interfaces:**
- Consumes: existing system status readiness data.
- Produces: operator guidance to use the local “Mantenimiento S_Hospital” shortcut; no restore API call.

- [ ] **Step 1: Replace the old “no restore actions” test**

Assert the page displays:

```text
Restauración local
Use el acceso “Mantenimiento S_Hospital” en esta computadora.
La restauración detiene temporalmente el sistema y crea un respaldo preventivo.
```

Assert there is no button named “Restaurar ahora” and no request to `/api/backups/*/restore`.

- [ ] **Step 2: Verify red**

Run:

```powershell
cd frontend
.\node_modules\.bin\vitest.cmd run src/features/backups/BackupsView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: fail because the recovery card is absent.

- [ ] **Step 3: Implement the accessible readiness card**

Use a heading, explanatory text, readiness blocker list, and link to `/support`. Do not expose filenames, checksums, paths, worker names, or command lines.

- [ ] **Step 4: Update runbooks**

Document both validation and production recovery, operator confirmations, rollback behavior, and evidence fields.

- [ ] **Step 5: Verify UI tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run src/features/backups --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: all backup feature tests pass.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/features/backups docs/BACKUP_RESTORE.md docs/backup-restore-runbook.md
git commit -m "feat(backups): guide guarded local recovery"
```

### Task 6: Prove automatic backup and recovery in an isolated MariaDB release

**Files:**
- Modify: `scripts/run_release_e2e_mariadb.ps1`
- Modify: `scripts/run_release_e2e_mariadb.test.ps1`
- Create: `qa/RECOVERY_CERTIFICATION.example.md`
- Modify: `docs/RELEASE_CHECKLIST.md`

**Interfaces:**
- Produces: redacted evidence containing timestamps, relative backup identifier, checksum, counts, preventive backup result, restore result, and rollback drill result.

- [ ] **Step 1: Add failing release-script contract tests**

Assert the script requires isolated compose project/database names and refuses the configured production database.

- [ ] **Step 2: Implement the isolated drill**

Run scheduled backup, restore to disposable DB, execute guarded replacement against a second isolated DB, inject one health-check failure to exercise rollback, then run a successful recovery.

- [ ] **Step 3: Run the drill**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\run_release_e2e_mariadb.ps1 -RecoveryDrill
```

Expected: exit zero, no production database touched, evidence file populated without secrets.

- [ ] **Step 4: Commit**

```powershell
git add scripts/run_release_e2e_mariadb.ps1 scripts/run_release_e2e_mariadb.test.ps1 qa/RECOVERY_CERTIFICATION.example.md docs/RELEASE_CHECKLIST.md
git commit -m "test(backups): certify automatic backup and recovery"
```

