# Operations objective audit - 2026-06-03

Decision: `PRODUCTION_CANDIDATE`.

Purpose:

- Trace the active operational-hardening objective to current evidence.
- Separate local/code evidence from final-field evidence that still needs the hospital server, LAN client and printer.
- Prevent a false `PRODUCTION_READY` claim while any final physical or production-environment proof is missing.

## Requirement matrix

| Requirement from objective | Current evidence | Status | Remaining proof before completion |
|---|---|---|---|
| Repository, backend, installer, database, migrations, logs, backups, manuals and tests audited before broad refactor | `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md`, `qa/OPS_EVIDENCE_INDEX_2026_06_03.md`, `qa/FINAL_HANDOFF_COMPLETENESS_2026_06_03.md` | `VALIDATED_LOCAL` | Keep evidence current after each new phase |
| Browser evidence for critical flows with console issues captured | `qa/browser-smoke-2026-06-03/rc-e2e-mocked-report.json`, `qa/BROWSER_SMOKE_EVIDENCE_2026_06_03.md` | `VALIDATED_LOCAL` | Repeat smoke on final server/LAN after production install |
| In-app institutional Help for cashier workflows, failures and support summary | `qa/HELP_SCREEN_SAFETY_2026_06_03.md`, `frontend/src/features/help/HelpView.tsx` | `VALIDATED_LOCAL` | Verify with real cashier/supervisor during training |
| Human-safe support evidence that redacts secrets and local paths | `qa/SUPPORT_PACKET_SAFETY_2026_06_03.md`, `qa/SUPPORT_PACKET_ENV_FILE_REDACTION_2026_06_03.md`, `qa/CLIENT_SUPPORT_SANITIZATION_2026_06_03.md` | `VALIDATED_LOCAL` | Confirm staff know not to attach `.env`, SQL dumps or passwords |
| Local diagnostics for backend, database, frontend, backups, queue, time, disk, LAN and version with advanced details gated | `qa/SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md`, `qa/SYSTEM_STATUS_HEARTBEAT_SANITIZATION_2026_06_03.md` | `VALIDATED_LOCAL` | Verify on final server with production settings and real backup tasks |
| Institutional installer, startup shortcut, backup tasks and safe repair script | `qa/INSTALLATION_DOCS_SAFETY_2026_06_03.md`, `qa/STARTUP_REPAIR_SAFETY_2026_06_03.md`, `qa/STARTUP_REPAIR_AUTOMATION_SMOKE_2026_06_03.md` | `VALIDATED_LOCAL` | Install/update Windows tasks on final server and run final startup/repair smoke |
| Recovery guidance for power loss, restart, browser closed, LAN change, printer failure, open cashbox, failed backup and restore | `qa/SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md`, `qa/LAN_RECOVERY_SAFETY_2026_06_03.md` | `VALIDATED_LOCAL` | Drill at least one supervised shift incident with hospital staff |
| Duplicate-action protection for cashbox, invoice and payment workflows | `qa/DOUBLE_ACTION_SAFETY_2026_06_03.md`, `qa/FINAL_CONCURRENCY_PROOF.md` | `VALIDATED_LOCAL` | Re-run concurrency on final-server disposable target |
| Automatic and manual backup plus safe restore validation | `qa/BACKUP_WORKER_SMOKE_2026_06_03.md`, `qa/BACKUP_RESTORE_DOCS_SAFETY_2026_06_03.md`, `qa/FINAL_RESTORE_PROOF.md`, `qa/FINAL_RESTORE_PROOF_2026_06_03.md` | `PARTIAL_FIELD_BLOCKED` | Install final backup worker, run final backup worker smoke, restore only into disposable final-server database |
| Non-technical manuals and role checklists for cashier, supervisor and administrator | `qa/OPERATOR_MANUALS_SAFETY_2026_06_03.md`, `docs/manuales/INDICE_OPERADOR.md` | `VALIDATED_LOCAL` | Train real staff and record acceptance/feedback outside source control if it contains names |
| Safe practice/training guidance without touching production data | `qa/TRAINING_SAFETY_2026_06_03.md`, `docs/manuales/GUIA_CAPACITACION_SEGURA.md` | `VALIDATED_LOCAL` | Use isolated practice database or approved disposable environment for training |
| Final LAN client validation from a second computer by IP | `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`, `scripts/validate_lan_client.ps1` | `PENDING_FINAL_FIELD` | Complete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a real second PC on the hospital LAN |
| Physical institutional receipt proof for media carta, carta, A5, 80mm and 58mm | `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md`, `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md` | `PENDING_FINAL_FIELD` | Complete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` with real cashier printer evidence |
| Offline release package can be installed without internet and matches final commit | `qa/OFFLINE_RELEASE_GUARD_2026_06_03.md`, `scripts/assert_offline_release_clean.ps1` | `PENDING_FINAL_FIELD` | Regenerate `offline-release` from final commit with Docker image tar files and matching checksums |
| Final production environment and preflight | `qa/PREFLIGHT_WITH_CONCURRENCY_2026_06_03.md`, `scripts/production_readiness_preflight.ps1`, `scripts/final_production_handoff.ps1` | `PENDING_FINAL_FIELD` | Configure `APP_ENV=production`, `APP_DEBUG=false`, final LAN URL, scheduled tasks and run preflight without bypass flags; preflight now runs `scripts/validate_operations_objective_audit.ps1` first |

## Current blockers

- `qa/LAN_CLIENT_VALIDATION_PROOF.md` is not complete from a real second hospital LAN client.
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` is not complete from the real cashier printer.
- `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup` are not verified on the final server.
- Final production environment values, final backup worker smoke, final restore/concurrency evidence and final preflight are still missing.
- `offline-release` is stale and missing current guard scripts and Docker image tar files.

## Safety notes

- No `.env` file was deleted.
- No database volume was reset.
- No production data was restored over.
- No push was performed.
- This audit does not expose secrets, raw paths, database passwords, tokens or fiscal compliance claims.

## Conclusion

The objective is materially advanced and locally guarded, but it is not complete. Keep the release as `PRODUCTION_CANDIDATE` until the final-field blockers above are closed with evidence and `scripts\final_production_handoff.ps1` returns success without `-SkipPreflight` or bypass flags.
