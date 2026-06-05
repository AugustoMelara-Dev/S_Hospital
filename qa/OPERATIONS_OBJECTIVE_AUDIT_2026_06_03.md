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
| First-level support quick check stays executable from the final handoff | `qa/FIRST_LEVEL_SUPPORT_SAFETY_2026_06_04.md`, `qa/FIRST_LEVEL_SUPPORT_HANDOFF_2026_06_04.md`, `qa/FIRST_LEVEL_SUPPORT_HANDOFF_RESULT_2026_06_04.md`, `scripts/validate_first_level_support_safety.ps1` | `VALIDATED_LOCAL` | Run the handoff on the final server and keep this guard green before training staff to self-triage incidents |
| Local diagnostics for backend, database, frontend, backups, queue, time, disk, LAN and version with advanced details gated | `qa/SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md`, `qa/SYSTEM_STATUS_HEARTBEAT_SANITIZATION_2026_06_03.md` | `VALIDATED_LOCAL` | Verify on final server with production settings and real backup tasks |
| Institutional installer, startup shortcut, stack autostart, backup tasks and safe repair script | `qa/INSTALLATION_DOCS_SAFETY_2026_06_03.md`, `qa/STARTUP_REPAIR_SAFETY_2026_06_03.md`, `qa/STARTUP_REPAIR_AUTOMATION_SMOKE_2026_06_03.md`, `qa/FINAL_STARTUP_TASK_PROOF.example.md`, `qa/FINAL_STARTUP_TASK_PROOF.md`, `scripts/validate_final_startup_task_proof.ps1` | `PARTIAL_FIELD_BLOCKED` | Install/update `SistemaCajaHospitalaria-StackAutostart` with `AtStartup` on final server, observe startup/reboot recovery, confirm `/up` and login, then complete `qa/FINAL_STARTUP_TASK_PROOF.md` |
| Recovery guidance for power loss, restart, browser closed, LAN change, printer failure, open cashbox, failed backup and restore | `qa/SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md`, `qa/LAN_RECOVERY_SAFETY_2026_06_03.md`, `qa/LAN_LOADTEST_SAFETY_2026_06_04.md`, `qa/LAN_LOADTEST_HANDOFF_2026_06_04.md`, `docs/DECISION_LAN_LOADTEST_HANDOFF_2026_06_04.md` | `VALIDATED_LOCAL` | Drill at least one supervised shift incident with hospital staff; run LAN/loadtest only against disposable validation targets |
| Known limitations and local blockers stay accurate for support handoff | `qa/KNOWN_LIMITATIONS_SAFETY_2026_06_03.md`, `docs/KNOWN_LIMITATIONS.md` | `VALIDATED_LOCAL` | Keep this guard current when moving items between pending, documented scope and final-field blockers |
| Safe maintenance mode during incidents | `qa/MAINTENANCE_MODE_SAFETY_2026_06_03.md`, `backend/tests/Feature/MaintenanceModeTest.php` | `VALIDATED_LOCAL` | Drill with supervisor/admin on the final server before relying on it during a live incident |
| Permission changes are durably audited | `qa/PERMISSION_AUDIT_SAFETY_2026_06_03.md`, `backend/tests/Feature/PermissionAuditTest.php` | `VALIDATED_LOCAL` | Verify user/role administration with the final administrator during training and keep audit access restricted |
| Per-user rate limiting protects LAN cashier writes | `qa/RATE_LIMIT_SAFETY_2026_06_03.md`, `backend/tests/Feature/ThrottleByUserTest.php` | `VALIDATED_LOCAL` | Re-run smoke on final LAN if many clients report 429 responses during training |
| Realtime own-event notifications do not distract the acting cashier | `qa/REALTIME_OWN_EVENT_SAFETY_2026_06_04.md`, `scripts/validate_realtime_own_event_safety.ps1`, `backend/tests/Feature/BroadcastingWiringTest.php`, `frontend/src/lib/realtime/useBroadcastSync.test.ts` | `VALIDATED_LOCAL` | Repeat realtime smoke with two physical LAN clients before relying on it for final multi-PC cashier awareness |
| Duplicate-action protection for cashbox, invoice and payment workflows | `qa/DOUBLE_ACTION_SAFETY_2026_06_03.md`, `qa/FINAL_CONCURRENCY_PROOF.md` | `VALIDATED_LOCAL` | Re-run concurrency on final-server disposable target |
| Automatic and manual backup plus safe restore validation | `qa/BACKUP_WORKER_SMOKE_2026_06_03.md`, `qa/BACKUP_RESTORE_DOCS_SAFETY_2026_06_03.md`, `qa/FINAL_BACKUP_TASK_PROOF.example.md`, `qa/FINAL_BACKUP_TASK_PROOF.md`, `scripts/validate_final_backup_task_proof.ps1`, `qa/FINAL_RESTORE_PROOF.md`, `qa/FINAL_RESTORE_PROOF_2026_06_03.md`, `scripts/validate_final_handoff_completeness.ps1` | `PARTIAL_FIELD_BLOCKED` | Install final backup worker, run final backup worker smoke, complete `qa/FINAL_BACKUP_TASK_PROOF.md` after a manual UI backup moves from pending to success, restore only into disposable final-server database |
| Backup startup without administrator rights | `qa/BACKUP_STARTUP_CURRENT_USER_SAFETY_2026_06_04.md`, `scripts/validate_backup_startup_current_user_safety.ps1`, `scripts/install_backup_startup_current_user.ps1`, `scripts/start_backup_automation.cmd`, `scripts/run_backup_scheduler_loop.ps1` | `VALIDATED_LOCAL` | Use only if Windows scheduled tasks cannot be installed; validate `-WhatIfOnly` and `-Status` on the final server before relying on current-user Startup/HKCU fallback |
| Non-technical manuals and role checklists for cashier, supervisor and administrator | `qa/OPERATOR_MANUALS_SAFETY_2026_06_03.md`, `docs/manuales/INDICE_OPERADOR.md` | `VALIDATED_LOCAL` | Train real staff and record any acceptance with anonymized evidence only |
| Safe practice/training guidance without touching production data | `qa/TRAINING_SAFETY_2026_06_03.md`, `qa/TRAINING_ACCEPTANCE_PROOF.example.md`, `qa/TRAINING_ACCEPTANCE_PROOF.md`, `scripts/validate_training_acceptance_proof.ps1`, `docs/manuales/GUIA_CAPACITACION_SEGURA.md` | `VALIDATED_LOCAL` | Use isolated practice database or approved disposable environment for training; run the acceptance guard in strict mode before final readiness; fill anonymized acceptance proof after real training |
| Final LAN client validation from a second computer by IP | `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`, `scripts/validate_lan_client.ps1`, `scripts/init_production_proofs.ps1`, `qa/FIELD_PROOF_TEMPLATES_SAFETY_2026_06_03.md`, `qa/PROOF_INITIALIZATION_SAFETY_2026_06_03.md` | `PENDING_FINAL_FIELD` | Run `scripts\final_production_handoff.ps1 -InitializeProofFiles`, then complete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a real second PC on the hospital LAN |
| Physical institutional receipt proof for media carta, carta, A5, 80mm and 58mm | `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md`, `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`, `scripts/init_production_proofs.ps1`, `qa/FIELD_PROOF_TEMPLATES_SAFETY_2026_06_03.md`, `qa/PROOF_INITIALIZATION_SAFETY_2026_06_03.md` | `PENDING_FINAL_FIELD` | Run `scripts\final_production_handoff.ps1 -InitializeProofFiles`, then complete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` with real cashier printer evidence |
| Offline release package can be installed without internet and matches final commit | `qa/OFFLINE_RELEASE_BUILDER_SELFTEST_2026_06_03.md`, `qa/OFFLINE_RELEASE_GUARD_2026_06_03.md`, `qa/OFFLINE_RELEASE_REGEN_2026_06_04.md`, `scripts/make_offline_release.ps1`, `scripts/assert_offline_release_clean.ps1`, `scripts/validate_dependency_manifest.ps1`, `scripts/validate_lan_loadtest_safety.ps1` | `VALIDATED_LOCAL` | Copy `offline-release` to final installation media/server and verify `assert_offline_release_clean.ps1 -RequireCurrentCommit` and dependency manifest there before handoff |
| Production license salt cannot be missing or weak | `qa/PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md`, `scripts/validate_production_license_salt_guard.ps1`, `backend/tests/Unit/LicenseSaltGuardTest.php`, `docker-compose.prod.yml` | `VALIDATED_LOCAL` | Generate a real 32+ character `HOSPITAL_LICENSE_SALT` on the final server; do not print it, commit it or reuse the placeholder used for local validation |
| `PRODUCTION_READY` gate and final-field blockers cannot be bypassed silently | `qa/PRODUCTION_READY_GATE_VALIDATOR_2026_06_04.md`, `qa/PRODUCTION_READY_GATE_HANDOFF_2026_06_04.md`, `qa/PRODUCTION_READY_GATE_HANDOFF_RESULT_2026_06_04.md`, `qa/FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md`, `scripts/validate_production_ready_gate_safety.ps1`, `scripts/validate_final_field_blockers_safety.ps1` | `VALIDATED_LOCAL` | Keep final LAN, printer, restore and concurrency proof incomplete until real field evidence exists; do not use bypass flags for final approval |
| Final production environment and preflight | `qa/PREFLIGHT_WITH_CONCURRENCY_2026_06_03.md`, `scripts/production_readiness_preflight.ps1`, `scripts/final_production_handoff.ps1`, `qa/PRODUCTION_READY_GATE_HANDOFF_RESULT_2026_06_04.md` | `PENDING_FINAL_FIELD` | Configure `APP_ENV=production`, `APP_DEBUG=false`, final LAN URL, scheduled tasks and run preflight without bypass flags; preflight now runs `scripts/validate_operations_objective_audit.ps1` first |

## Current blockers

- `qa/LAN_CLIENT_VALIDATION_PROOF.md` is not complete from a real second hospital LAN client.
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` is not complete from the real cashier printer.
- `SistemaCajaHospitalaria-StackAutostart` and `qa\FINAL_STARTUP_TASK_PROOF.md`,
  `SistemaCajaHospitalaria-BackupWorker` and
  `SistemaCajaHospitalaria-DailyBackup` are not verified on the final server.
- Final production environment values, final startup task proof, final backup worker smoke, final backup task proof, final restore/concurrency evidence and final preflight are still missing.
- Final supervised staff training has not been recorded in `qa\TRAINING_ACCEPTANCE_PROOF.md`; do not include staff names or patient data when it is completed.
- `offline-release` was regenerated locally with Docker image tar files and current guards; it still must be copied to the final server/media and verified there before handoff.
- `scripts\final_production_handoff.ps1 -InitializeProofFiles` must be used during final closure so missing proof drafts are created safely without overwriting real evidence.
- The 2026-06-04 handoff guard evidence proves the local gate wiring, not the final hospital LAN, printer, restore or concurrency proof.

## Safety notes

- No `.env` file was deleted.
- No database volume was reset.
- No production data was restored over.
- No push was performed.
- This audit does not expose secrets, raw paths, database passwords, tokens or fiscal compliance claims.

## Conclusion

The objective is materially advanced and locally guarded, but it is not complete. Keep the release as `PRODUCTION_CANDIDATE` until the final-field blockers above are closed with evidence and `scripts\final_production_handoff.ps1` returns success without `-SkipPreflight` or bypass flags.
