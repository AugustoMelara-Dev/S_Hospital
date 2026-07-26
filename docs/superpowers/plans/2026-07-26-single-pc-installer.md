# Single-PC Installer and Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `setup.bat` install S_Hospital offline on one Windows PC in a guided flow that verifies the runtime, activates backups, and creates recognizable application and maintenance shortcuts.

**Architecture:** Keep `scripts/deploy_hospital_lan.ps1` as the canonical orchestrator, extract pure installation decisions into testable modules, and make single-PC loopback the recommended mode while retaining optional LAN configuration. Generate `.lnk` shortcuts through Windows Script Host with a `.url` fallback.

**Tech Stack:** Windows 10/11, PowerShell 5.1, Batch, Docker Compose or local PHP/MySQL, Laravel, Nginx, Task Scheduler.

## Global Constraints

- Installation must work without internet when offline images/runtime are present.
- A single installation owns the only database; LAN clients never get independent databases.
- Existing `.env`, database volumes, backup encryption key, and user data are preserved.
- No installer log may contain passwords, application keys, backup keys, or DB credentials.
- “Completed” is printed only after health, migration, admin, scheduler/worker, and shortcut checks.
- Every behavior change follows red-green-refactor and ends in a Conventional Commit.

---

### Task 1: Make deployment mode an explicit tested decision

**Files:**
- Create: `scripts/lib/install_mode.ps1`
- Create: `scripts/install_mode.test.ps1`
- Modify: `scripts/deploy_hospital_lan.ps1`

**Interfaces:**
- Produces: `Resolve-InstallMode -Choice SinglePc|Lan -DetectedIp string` returning `AppHost`, `AppUrl`, `LanEnabled`, `FirewallRequired`.

- [ ] **Step 1: Write failing pure-function tests**

Assert:

```powershell
Resolve-InstallMode -Choice SinglePc -DetectedIp '192.168.1.10'
# AppHost=127.0.0.1, AppUrl=http://127.0.0.1:<port>, LanEnabled=false

Resolve-InstallMode -Choice Lan -DetectedIp '192.168.1.10'
# AppHost=192.168.1.10, LanEnabled=true, FirewallRequired=true
```

Reject loopback/APIPA/virtual-only addresses for LAN; do not reject loopback for SinglePc.

- [ ] **Step 2: Verify red**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_mode.test.ps1
```

Expected: fail because module does not exist.

- [ ] **Step 3: Implement the pure resolver**

No environment mutation or console prompts belong in the module.

- [ ] **Step 4: Integrate the initial installer prompt**

Present:

```text
[1] Esta computadora (recomendado)
[2] Servidor para otras computadoras de la red
```

Only option 2 asks the operator to select/confirm a LAN IP and creates a firewall rule.

- [ ] **Step 5: Verify self-tests**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_mode.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\deploy_hospital_lan.ps1 -SelfTest
```

Expected: exit zero.

- [ ] **Step 6: Commit**

```powershell
git add scripts/lib/install_mode.ps1 scripts/install_mode.test.ps1 scripts/deploy_hospital_lan.ps1
git commit -m "feat(installer): prefer guided single-pc deployment"
```

### Task 2: Create robust application and maintenance shortcuts

**Files:**
- Modify: `scripts/install_hospital_startup_shortcut.ps1`
- Create: `scripts/install_hospital_startup_shortcut.test.ps1`
- Create: `frontend/public/icons/hospital-app.ico` only if no suitable local `.ico` exists
- Modify: `scripts/deploy_hospital_lan.ps1`

**Interfaces:**
- Produces: `Install-HospitalShortcuts -ProjectRoot -Url -MaintenanceScript -WhatIfOnly`.
- Outputs: `S_Hospital.lnk` and `Mantenimiento S_Hospital.lnk` on Desktop; optional Start Menu copies.

- [ ] **Step 1: Write failing shortcut contract tests**

Run the script with `-WhatIfOnly -OutputRoot <temporary directory>` and assert the returned plan contains:

```text
S_Hospital
http://127.0.0.1:<port>
Mantenimiento S_Hospital
scripts\restore_hospital_windows.ps1
```

Assert paths with spaces are quoted and existing unrelated shortcuts are never overwritten.

- [ ] **Step 2: Verify red**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_hospital_startup_shortcut.test.ps1
```

Expected: fail because current script only creates one `.url` without testable modes.

- [ ] **Step 3: Implement `.lnk` generation**

Use `WScript.Shell.CreateShortcut`. Application target uses the default browser through the URL; maintenance target is:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<root>\scripts\restore_hospital_windows.ps1"
```

Set working directory and icon. If COM shortcut creation fails, create an application `.url` and a maintenance `.cmd` only inside the chosen shortcut output directory, then report a warning.

- [ ] **Step 4: Invoke shortcuts after successful health checks**

The deployer calls the shortcut script only after migrations/admin/services succeed. A shortcut failure is a visible warning, not a false installation failure.

- [ ] **Step 5: Run tests**

Run both shortcut tests and deployer self-test. Inspect generated shortcuts only inside a temporary test directory.

- [ ] **Step 6: Commit**

```powershell
git add scripts/install_hospital_startup_shortcut.ps1 scripts/install_hospital_startup_shortcut.test.ps1 scripts/deploy_hospital_lan.ps1 frontend/public/icons
git commit -m "feat(installer): create application and maintenance shortcuts"
```

### Task 3: Verify automatic backups during installation

**Files:**
- Modify: `scripts/deploy_hospital_lan.ps1`
- Modify: `scripts/test_installer_diagnostics.ps1`
- Modify: `scripts/install_backup_tasks_windows.ps1`
- Modify: `docker-compose.prod.yml`

**Interfaces:**
- Consumes: Docker scheduler/queue health or Windows scheduled task status.
- Produces: installation check `BackupAutomationReady=true|false` and one successful encrypted test backup.

- [ ] **Step 1: Add failing diagnostic tests**

Mock Docker and Task Scheduler outputs and assert:

- Docker mode requires healthy `queue-worker` and `scheduler`.
- Bare-metal mode requires registered/running worker task and enabled daily task.
- A backup command exit zero without a recorded encrypted file is not success.

- [ ] **Step 2: Verify red**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test_installer_diagnostics.ps1
```

Expected: new backup readiness assertions fail.

- [ ] **Step 3: Implement post-install backup verification**

Run `hospital:backup --type=manual --json`, validate status/checksum/file through Laravel, and display:

```text
[OK] Respaldo local cifrado verificado.
```

On failure, installation ends as “requiere atención” and prints the safe remediation path; it must not print “despliegue completado”.

- [ ] **Step 4: Verify Docker and bare-metal branches**

Use injected command runners in self-tests. Do not create real scheduled tasks in tests.

- [ ] **Step 5: Commit**

```powershell
git add scripts/deploy_hospital_lan.ps1 scripts/test_installer_diagnostics.ps1 scripts/install_backup_tasks_windows.ps1 docker-compose.prod.yml
git commit -m "fix(installer): verify automatic backup readiness"
```

### Task 4: Make final installation status truthful and actionable

**Files:**
- Create: `scripts/lib/install_result.ps1`
- Create: `scripts/install_result.test.ps1`
- Modify: `scripts/deploy_hospital_lan.ps1`
- Modify: `setup.bat`

**Interfaces:**
- Produces: `Get-InstallResult -Checks hashtable` returning `Success`, `Warnings`, `Blockers`, `SafeSummary`.

- [ ] **Step 1: Write failing result tests**

Required success checks:

```text
runtime, database, migrations, admin, web-health,
queue-worker, scheduler, encrypted-backup, app-shortcut
```

Maintenance shortcut may be a warning if the script remains accessible from the installed folder. Any required false check prevents success.

- [ ] **Step 2: Verify red**

Run the result test script and expect failure because result aggregation is currently scattered.

- [ ] **Step 3: Implement and integrate one final status**

Success summary includes only mode, local URL, optional LAN URL, backup time, shortcut status, and log location. Redact user-specific absolute paths as `%PROJECT_ROOT%` in shareable output.

- [ ] **Step 4: Ensure `setup.bat` propagates exit codes**

`setup.bat` must return the PowerShell exit code and keep the window open with a concise next action on failure.

- [ ] **Step 5: Verify**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_result.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\deploy_hospital_lan.ps1 -SelfTest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test_installer_diagnostics.ps1
```

Expected: all exit zero.

- [ ] **Step 6: Commit**

```powershell
git add scripts/lib/install_result.ps1 scripts/install_result.test.ps1 scripts/deploy_hospital_lan.ps1 setup.bat
git commit -m "fix(installer): report verified deployment outcome"
```

### Task 5: Synchronize and test the offline release

**Files:**
- Modify: `scripts/make_offline_release.ps1`
- Modify: `scripts/offline_release_contract.test.ps1`
- Regenerate: `offline-release/setup.bat`
- Regenerate: `offline-release/scripts/*`
- Regenerate: `offline-release/docker-compose.prod.yml`
- Modify: `docs/OFFLINE_INSTALL.md`
- Modify: `docs/INSTALL_SUMMARY.md`

**Interfaces:**
- Produces: offline package containing the exact tested installer, recovery helper, shortcut icon, compose services, and documentation.

- [ ] **Step 1: Add failing release contract assertions**

Assert the package includes:

```text
scripts/lib/install_mode.ps1
scripts/lib/install_result.ps1
scripts/lib/recovery_contract.ps1
scripts/lib/recovery_runtime.ps1
scripts/install_hospital_startup_shortcut.ps1
scripts/restore_hospital_windows.ps1
```

Assert source and offline copies have matching SHA-256 hashes.

- [ ] **Step 2: Verify red**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\offline_release_contract.test.ps1
```

Expected: fail until package builder includes new assets.

- [ ] **Step 3: Update package builder and documentation**

Document the recommended single-PC option, icon behavior, backup verification, recovery shortcut, and optional LAN enablement.

- [ ] **Step 4: Build and verify the offline release**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\offline_release_contract.test.ps1
```

Expected: package build and contract pass; no network is required to operate the resulting package.

- [ ] **Step 5: Commit**

```powershell
git add scripts/make_offline_release.ps1 scripts/offline_release_contract.test.ps1 offline-release docs/OFFLINE_INSTALL.md docs/INSTALL_SUMMARY.md
git commit -m "test(installer): certify offline single-pc package"
```

