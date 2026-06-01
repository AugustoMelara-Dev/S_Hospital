# Final production handoff result

- Superseded at: 2026-05-31
- Decision: PRODUCTION_CANDIDATE
- Previous `PRODUCTION_READY` report: invalidated

## Reason

The previous handoff report claimed completed physical printer evidence, but
the referenced local photo folder was not present in this repository. Until the
cashier computer, institutional receipt printer, final restore, final
concurrency, backup automation and offline artifact are validated with real
field evidence, the system must not be described as `PRODUCTION_READY`.

## Current blockers

- Regenerate `offline-release` from the current commit and pass
  `scripts/assert_offline_release_clean.ps1 -RequireCurrentCommit`.
- Complete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a real second LAN client.
- Complete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` from the real cashier computer and real printer.
- Complete `qa/FINAL_RESTORE_PROOF.md` from a disposable restore database on the final server.
- Complete `qa/FINAL_CONCURRENCY_PROOF.md` from a disposable or explicitly approved final target.
- Run `scripts/production_readiness_preflight.ps1` without `-AllowMissingPhysicalProof`.
- Regenerate this handoff report only after the preflight passes with real LAN,
  printer, restore, concurrency and offline artifact evidence.

## Required command

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://SERVER_LAN_IP:8000 -PhpPath C:\xampp\php\php.exe
```
