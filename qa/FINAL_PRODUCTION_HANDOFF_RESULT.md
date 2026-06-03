# Final production handoff result

- Updated at: 2026-06-02
- Decision: PRODUCTION_CANDIDATE
- Code state: v1.0.0-rc.3 (see CHANGELOG.md)
- Last evidence check: 2026-06-02

## Code state summary (auditable)

| Phase | Code change | Tests | Status |
|-------|-------------|-------|--------|
| A9  | LicenseHelper salt moved to env | 7 | done |
| A2.1 | cents columns on invoices/invoice_items | covered by 50+ tests | done |
| A2.2 | removed SQL ROUND(* 100) in all report services | 12 guard tests | done |
| A1+A8 | CSP nonce in production, unsafe-inline removed from script-src | 12 tests | done |
| A3 | wait-for-db entrypoint + setup.bat | manual | done |
| A4 | rate limit /api/health and /api/system/health | 6 tests | done |
| A7 | CSP report-uri hardened (size + content-type + rate limit) | 7 tests | done |
| A10 | audit_logs and failed_jobs prune jobs | 4 tests | done |
| A5 | NewInvoiceView 775 -> 490 lines (Layout extracted) | 38 tests | done |
| A6 | BackupsView surfaces worker heartbeat | 3 tests | done |

Backend tests: 340 PHPUnit passing (4 skipped are concurrent fiscal race tests that require real MySQL).
Frontend tests: 211 Vitest passing (203 + 8 new during refactor).

## Required physical evidence (must be collected on real hardware)

The system is **PRODUCTION_CANDIDATE** and must not be described as `PRODUCTION_READY` until the following evidence is collected against the real hospital server:

- `qa/LAN_CLIENT_VALIDATION_PROOF.md` completed by an operator from a real second PC in the LAN.
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` completed by printing media carta / carta / A5 / 80mm / 58mm from the real cashier computer and printer.
- `qa/FINAL_RESTORE_PROOF.md` completed by running `scripts/validate_restore_mysql.sh` against a disposable database on the final server.
- `qa/FINAL_CONCURRENCY_PROOF.md` completed by running `scripts/validate_mysql_concurrency.sh` against a disposable or explicitly approved final target.
- `install_backup_tasks_windows.ps1` executed and the worker task `SistemaCajaHospitalaria-BackupWorker` is `Running`.
- `offline-release/MANIFEST.txt` regenerated from the current commit and `scripts/assert_offline_release_clean.ps1 -RequireCurrentCommit` passes.
- `scripts/production_readiness_preflight.ps1` returns 0 without `-AllowMissingPhysicalProof`.

## Scripts ready to run

```powershell
# 1. Pre-rellenar las plantillas (idempotente):
powershell.exe -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1

# 2. Validar LAN cliente:
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://SERVER_LAN_IP:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md

# 3. Instalar tareas de backup:
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -WhatIfOnly
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker

# 4. Restore + concurrencia sobre base descartable:
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test bash scripts/validate_restore_mysql.sh
HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONCURRENCY_BASE_URL=http://SERVER_LAN_IP:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=local HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://SERVER_LAN_IP:8000 bash scripts/validate_mysql_concurrency.sh

# 5. Regenerar paquete offline:
powershell.exe -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -Force
powershell.exe -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit

# 6. Preflight final (debe retornar 0 sin -AllowMissingPhysicalProof):
powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://SERVER_LAN_IP:8000

# 7. Handoff guiado:
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://SERVER_LAN_IP:8000 -PhpPath C:\xampp\php\php.exe -InitializeProofFiles
```

## Current blockers

- Physical evidence (LAN, printer, restore, concurrency) cannot be generated in the audit environment.
- `offline-release` must be regenerated after the final commit is tagged.

## Decision

Until the evidence above is collected, the system remains `PRODUCTION_CANDIDATE`.
Once all six physical proofs are signed and the preflight returns 0, this report can be updated to `PRODUCTION_READY`.
