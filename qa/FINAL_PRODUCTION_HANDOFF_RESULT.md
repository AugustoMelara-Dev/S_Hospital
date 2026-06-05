# Final production handoff result

- Generated at: 2026-06-05 06:49:42
- Base URL: http://192.168.1.10:8000
- Project root: %PROJECT_ROOT%
- Decision: PRODUCTION_CANDIDATE
- LAN client proof present without obvious placeholders: False
- Institutional receipt print proof present without obvious placeholders: False
- Final startup task proof present without obvious placeholders: False
- Final restore proof present without obvious placeholders: True
- Final backup task proof present without obvious placeholders: False
- Final concurrency proof present without obvious placeholders: True
- Supervised training acceptance proof present without obvious placeholders: False
- Backup scheduled tasks ready in status output: False
- LAN client proof file: `qa/LAN_CLIENT_VALIDATION_PROOF.md`
- Institutional receipt print proof file: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
- Final startup task proof file: `qa/FINAL_STARTUP_TASK_PROOF.md`
- Final restore proof file: `qa/FINAL_RESTORE_PROOF.md`
- Final backup task proof file: `qa/FINAL_BACKUP_TASK_PROOF.md`
- Final concurrency proof file: `qa/FINAL_CONCURRENCY_PROOF.md`
- Supervised training acceptance proof file: `qa/TRAINING_ACCEPTANCE_PROOF.md`
- Offline release artifact guard exit code: 1
- Support packet safety guard exit code: 0
- First-level support safety guard exit code: 0
- Production ready gate safety guard exit code: 0
- Final field blockers safety self-test exit code: 0
- Browser smoke evidence guard exit code: 0
- Startup and repair safety guard exit code: 0
- Operator manuals safety guard exit code: 0
- Backup and restore docs safety guard exit code: 0
- Backup startup current-user safety guard exit code: 0
- Windows restore safety guard exit code: 0
- Installation docs safety guard exit code: 0
- Help screen safety guard exit code: 0
- System diagnostics safety guard exit code: 0
- Double-action safety guard exit code: 0
- Realtime own-event safety guard exit code: 0
- Installer legacy safety guard exit code: 0
- LAN recovery safety guard exit code: 0
- LAN loadtest safety guard exit code: 0
- Known limitations safety guard exit code: 0
- Maintenance mode safety guard exit code: 0
- Permission audit safety guard exit code: 0
- Rate-limit safety guard exit code: 0
- Shift incident recovery safety guard exit code: 0
- New invoice maintainability guard exit code: 0
- Training safety guard exit code: 0
- Field proof templates safety guard exit code: 0
- Proof initialization safety guard exit code: 0
- Operations objective audit guard exit code: 0
- Handoff guard coverage guard exit code: 0
- Offline release staging safety guard exit code: 0
- Offline release builder self-test exit code: 0
- Offline release guard self-test exit code: 0
- Dependency manifest guard exit code: 0
- Production license salt guard exit code: 0
- Final handoff completeness guard exit code: 0
- Evidence index guard exit code: 0
- Preflight skipped: True
- Preflight exit code: 2

## Result

Do not declare PRODUCTION_READY. Keep the system as PRODUCTION_CANDIDATE until every blocker below is closed with real field evidence.

## Blocking items

- Missing or incomplete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a real second LAN client.
- Missing or incomplete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` from the real cashier printer.
- Missing or incomplete `qa/FINAL_STARTUP_TASK_PROOF.md` after installing stack autostart and confirming the server opens `/up` and login after startup.
- Missing or incomplete `qa/FINAL_BACKUP_TASK_PROOF.md` after installing backup tasks and confirming a manual UI backup moves from pending to success.
- Missing or incomplete `qa/TRAINING_ACCEPTANCE_PROOF.md` from supervised role training in a safe practice environment.
- Install or update Windows scheduled backup tasks `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup`, then confirm a manual UI backup moves from pending to success.
- Preflight was skipped in this handoff run.
- Offline release artifact is missing, stale, or contains forbidden files.

## Evidence completed in this hardening front

- Browser smoke screenshots: `qa/browser-smoke-2026-06-03/rc-e2e-mocked-report.json` and `qa/BROWSER_SMOKE_EVIDENCE_2026_06_03.md`.
- System diagnostics and Help/support guards: `qa/SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md`, `qa/HELP_SCREEN_SAFETY_2026_06_03.md`, `qa/SUPPORT_PACKET_SAFETY_2026_06_03.md`, `qa/FIRST_LEVEL_SUPPORT_SAFETY_2026_06_04.md`.
- Backup worker, startup, current-user startup, final backup task and restore evidence: `qa/BACKUP_WORKER_SMOKE_2026_06_03.md`, `qa/BACKUP_STARTUP_CURRENT_USER_SAFETY_2026_06_04.md`, `qa/FINAL_STARTUP_TASK_PROOF.example.md`, `qa/FINAL_STARTUP_TASK_PROOF.md`, `qa/FINAL_BACKUP_TASK_PROOF.example.md`, `qa/FINAL_BACKUP_TASK_PROOF.md`, `qa/FINAL_RESTORE_PROOF.md`, `qa/FINAL_RESTORE_PROOF_2026_06_03.md` and `qa/RESTORE_WINDOWS_SAFETY_2026_06_04.md`.
- Concurrency, double-action and realtime own-event evidence: `qa/FINAL_CONCURRENCY_PROOF.md`, `qa/DOUBLE_ACTION_SAFETY_2026_06_03.md` and `qa/REALTIME_OWN_EVENT_SAFETY_2026_06_04.md`.
- Startup, installation, LAN, known-limitations, maintenance, permission audit, rate-limit and shift incident recovery guards: `qa/STARTUP_REPAIR_SAFETY_2026_06_03.md`, `qa/INSTALLATION_DOCS_SAFETY_2026_06_03.md`, `qa/LAN_RECOVERY_SAFETY_2026_06_03.md`, `qa/LAN_LOADTEST_SAFETY_2026_06_04.md`, `qa/KNOWN_LIMITATIONS_SAFETY_2026_06_03.md`, `qa/MAINTENANCE_MODE_SAFETY_2026_06_03.md`, `qa/PERMISSION_AUDIT_SAFETY_2026_06_03.md`, `qa/RATE_LIMIT_SAFETY_2026_06_03.md`, `qa/SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md`.
- New invoice maintainability guard: `qa/NEW_INVOICE_MAINTAINABILITY_2026_06_04.md` and `scripts/validate_new_invoice_maintainability.ps1` preserve a short cashier-facing invoice flow.
- Operator and training evidence: `qa/OPERATOR_MANUALS_SAFETY_2026_06_03.md`, `qa/TRAINING_SAFETY_2026_06_03.md`, `qa/TRAINING_ACCEPTANCE_PROOF.example.md` and `qa/TRAINING_ACCEPTANCE_PROOF.md`.
- Field proof, final blockers, LAN client, LAN/loadtest, proof initialization, handoff guard coverage, offline release staging, offline builder, offline release guard, offline regeneration, objective, release and index evidence: `qa/FIELD_PROOF_TEMPLATES_SAFETY_2026_06_03.md`, `qa/FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md`, `qa/LAN_CLIENT_PROOF_GUARD_2026_06_05.md`, `qa/LAN_LOADTEST_SAFETY_2026_06_04.md`, `qa/LAN_LOADTEST_HANDOFF_2026_06_04.md`, `qa/PROOF_INITIALIZATION_SAFETY_2026_06_03.md`, `qa/HANDOFF_GUARD_COVERAGE_2026_06_04.md`, `qa/OFFLINE_RELEASE_STAGING_SAFETY_2026_06_04.md`, `qa/OFFLINE_RELEASE_BUILDER_SELFTEST_2026_06_03.md`, `qa/OFFLINE_RELEASE_GUARD_2026_06_03.md`, `qa/OFFLINE_RELEASE_REGEN_2026_06_04.md`, `qa/PRODUCTION_READY_GATE_VALIDATOR_2026_06_04.md`, `qa/PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md`, `qa/OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md`, `qa/OPS_EVIDENCE_INDEX_2026_06_03.md`.

## Tests and gates to preserve

- Backend static/format: `docker compose exec -T backend ./vendor/bin/pint --test`.
- Backend static analysis: `docker compose exec -T backend ./vendor/bin/phpstan analyse --memory-limit=1G`.
- Backend suite: `docker compose exec -T backend php artisan test`.
- Frontend gates: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test -- --run`, `npm.cmd run build`, `scripts\check-branding.ps1`.
- Browser and operational smoke: mocked E2E screenshots, `npm.cmd run smoke:real`, backup worker smoke, disposable restore, concurrency validation and `scripts\production_readiness_preflight.ps1`.

## Files changed in this handoff front

- In-app support and diagnostics: `frontend/src/features/help/HelpView.tsx`, `frontend/src/features/about/AboutView.tsx`, `frontend/src/hooks/useServerStatus.ts`, `frontend/src/lib/support/clientIssueLog.ts`, `backend/app/Http/Controllers/SystemStatusController.php`.
- Startup, installer and support scripts: `scripts/deploy_hospital_lan.ps1`, `scripts/start_hospital_services.ps1`, `scripts/open_hospital_system.ps1`, `scripts/repair_hospital_system.ps1`, `scripts/restore_hospital_windows.ps1`, `scripts/collect_support_packet.ps1`, `scripts/install_hospital_startup_shortcut.ps1`, `scripts/install_stack_autostart_windows.ps1`, `scripts/install_backup_tasks_windows.ps1`, `scripts/install_backup_startup_current_user.ps1`, `scripts/start_backup_automation.cmd`, `scripts/run_backup_scheduler_loop.ps1`, `scripts/init_production_proofs.ps1`, `scripts/refresh_lan_ip.ps1`, `scripts/make_offline_release.ps1`, `scripts/final_production_handoff.ps1`.
- Evidence guards: `scripts/assert_offline_release_clean.ps1`, `scripts/validate_browser_smoke_evidence.ps1`, `scripts/validate_startup_repair_safety.ps1`, `scripts/validate_operator_manuals_safety.ps1`, `scripts/validate_backup_restore_docs_safety.ps1`, `scripts/validate_backup_startup_current_user_safety.ps1`, `scripts/validate_restore_windows_safety.ps1`, `scripts/validate_installation_docs_safety.ps1`, `scripts/validate_help_screen_safety.ps1`, `scripts/validate_system_diagnostics_safety.ps1`, `scripts/validate_support_packet_safety.ps1`, `scripts/validate_first_level_support_safety.ps1`, `scripts/validate_production_ready_gate_safety.ps1`, `scripts/validate_final_field_blockers_safety.ps1`, `scripts/validate_double_action_safety.ps1`, `scripts/validate_realtime_own_event_safety.ps1`, `scripts/validate_installer_legacy_safety.ps1`, `scripts/validate_lan_recovery_safety.ps1`, `scripts/validate_lan_client_proof.ps1`, `scripts/validate_lan_loadtest_safety.ps1`, `scripts/validate_institutional_receipt_print_proof.ps1`, `scripts/validate_known_limitations_safety.ps1`, `scripts/validate_maintenance_mode_safety.ps1`, `scripts/validate_permission_audit_safety.ps1`, `scripts/validate_rate_limit_safety.ps1`, `scripts/validate_shift_incident_recovery_safety.ps1`, `scripts/validate_new_invoice_maintainability.ps1`, `scripts/validate_training_safety.ps1`, `scripts/validate_final_startup_task_proof.ps1`, `scripts/validate_final_backup_task_proof.ps1`, `scripts/validate_training_acceptance_proof.ps1`, `scripts/validate_field_proof_templates.ps1`, `scripts/validate_proof_initialization_safety.ps1`, `scripts/validate_operations_objective_audit.ps1`, `scripts/validate_handoff_guard_coverage.ps1`, `scripts/validate_offline_release_staging_safety.ps1`, `scripts/validate_dependency_manifest.ps1`, `scripts/validate_production_license_salt_guard.ps1`, `scripts/validate_ops_evidence_index.ps1`, `scripts/validate_final_handoff_completeness.ps1`.
- Operator material and evidence: `docs/manuales`, `docs/RELEASE_CHECKLIST.md`, `qa/TRAINING_ACCEPTANCE_PROOF.example.md`, QA evidence files dated 2026-06-03 and `qa/browser-smoke-2026-06-03`.

## Risks and limits

- Local Docker and mocked browser evidence do not replace final second-client LAN proof, real MariaDB/server proof or physical printer proof.
- The offline release package must still be copied to the final server and verified there before production use.
- Final production environment must be verified with APP_ENV=production and APP_DEBUG=false before production handoff.
- Windows scheduled tasks `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup` must be installed or updated on the final server.
- Fiscal sequences/settings require administrative validation in the real environment; fiscal compliance was not invented by this report.
- Any restore or concurrency validation must use a disposable target or explicitly approved validation database, never the active production database.

## Safety notes

- No `.env` file was deleted.
- No database volume was reset.
- No production data was restored over.
- No push was performed.
- Secrets were not printed in evidence files.
- Fiscal compliance was not invented; fiscal sequences/settings still require real administrative validation before production use.

## Next commands

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://192.168.1.10:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1 -WhatIfOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -UpdateExisting
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -Status
# Then observe a server startup/reboot or supervised manual task start, confirm /up and login, and complete qa\FINAL_STARTUP_TASK_PROOF.md.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath php
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath php
# Then create one manual backup from the admin UI, confirm it moves from pending to success, and complete qa\FINAL_BACKUP_TASK_PROOF.md.
bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"
# Set HOSPITAL_CONCURRENCY_LOGIN and HOSPITAL_CONCURRENCY_PASSWORD for a temporary validation account outside this report.
bash -lc "HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://192.168.1.10:8000 HOSPITAL_CONCURRENCY_BASE_URL=http://192.168.1.10:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_first_level_support_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_production_ready_gate_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_field_blockers_safety.ps1 -SelfTest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_browser_smoke_evidence.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_startup_repair_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_operator_manuals_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_backup_restore_docs_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_backup_startup_current_user_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_restore_windows_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installation_docs_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_help_screen_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_system_diagnostics_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_double_action_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_realtime_own_event_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installer_legacy_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_recovery_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_loadtest_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client_proof.ps1 -AllowPendingFinalField
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_known_limitations_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_maintenance_mode_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_institutional_receipt_print_proof.ps1 -AllowPendingHardwareValidation
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_permission_audit_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_rate_limit_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_shift_incident_recovery_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_new_invoice_maintainability.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_training_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_startup_task_proof.ps1 -AllowPendingFinalField
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_backup_task_proof.ps1 -AllowPendingFinalField
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_training_acceptance_proof.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_field_proof_templates.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_proof_initialization_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -SelfTest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -SelfTest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_operations_objective_audit.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_handoff_guard_coverage.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_offline_release_staging_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_dependency_manifest.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_production_license_salt_guard.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_handoff_completeness.ps1 -HandoffPath %PROJECT_ROOT%\qa\FINAL_PRODUCTION_HANDOFF_RESULT.md
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_ops_evidence_index.ps1 -HandoffPath %PROJECT_ROOT%\qa\FINAL_PRODUCTION_HANDOFF_RESULT.md
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://192.168.1.10:8000
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://192.168.1.10:8000 -PhpPath php
```

## Backup task status output

```text
Preparando tareas programadas de respaldos para Sistema de Caja Hospitalaria.
Instalacion: %PROJECT_ROOT%
Modo: no requerido para esta accion
Worker: %PROJECT_ROOT%\scripts\run_backup_worker.cmd
Respaldo diario: %PROJECT_ROOT%\scripts\run_scheduled_backup.cmd
Tarea worker: SistemaCajaHospitalaria-BackupWorker
Tarea diaria: SistemaCajaHospitalaria-DailyBackup
SistemaCajaHospitalaria-BackupWorker: no instalada
SistemaCajaHospitalaria-DailyBackup: no instalada
Confirme que el worker esta activo y que un respaldo creado desde la UI pasa de pendiente a completado.
```

## Offline release artifact guard output

```text
Checking offline release: %PROJECT_ROOT%\offline-release
[ OK ] Found setup.bat
[ OK ] Found docker-compose.prod.yml
[ OK ] Found backend\Dockerfile.prod
[ OK ] Found nginx\default.conf
[ OK ] Found nginx\hospital-common.conf
[ OK ] Found MANIFEST.txt
[ OK ] Found checksums.sha256
[ OK ] Found offline-images
[ OK ] Found scripts\assert_offline_release_clean.ps1
[ OK ] Found scripts\deploy_hospital_lan.ps1
[ OK ] Found scripts\init_production_proofs.ps1
[ OK ] Found scripts\load_offline_images.ps1
[ OK ] Found scripts\make_offline_release.ps1
[ OK ] Found scripts\production_readiness_preflight.ps1
[ OK ] Found scripts\final_production_handoff.ps1
[ OK ] Found scripts\install_hospital_startup_shortcut.ps1
[ OK ] Found scripts\install_stack_autostart_windows.ps1
[ OK ] Found scripts\install_backup_startup_current_user.ps1
[ OK ] Found scripts\install_backup_tasks_windows.ps1
[ OK ] Found scripts\restore_hospital_windows.ps1
[ OK ] Found scripts\validate_support_packet_safety.ps1
[ OK ] Found scripts\validate_browser_smoke_evidence.ps1
[ OK ] Found scripts\validate_dependency_manifest.ps1
[ OK ] Found scripts\validate_startup_repair_safety.ps1
[ OK ] Found scripts\validate_operator_manuals_safety.ps1
[ OK ] Found scripts\validate_backup_restore_docs_safety.ps1
[ OK ] Found scripts\validate_backup_startup_current_user_safety.ps1
[ OK ] Found scripts\validate_installation_docs_safety.ps1
[ OK ] Found scripts\validate_help_screen_safety.ps1
[ OK ] Found scripts\validate_system_diagnostics_safety.ps1
[ OK ] Found scripts\validate_known_limitations_safety.ps1
[ OK ] Found scripts\validate_ops_evidence_index.ps1
[ OK ] Found scripts\validate_final_startup_task_proof.ps1
[ OK ] Found scripts\validate_final_backup_task_proof.ps1
[ OK ] Found scripts\validate_training_acceptance_proof.ps1
[ OK ] Found scripts\validate_training_safety.ps1
[ OK ] Found scripts\validate_double_action_safety.ps1
[ OK ] Found scripts\validate_installer_legacy_safety.ps1
[FAIL] Missing required release file: scripts\validate_lan_client_proof.ps1
[ OK ] Found scripts\validate_lan_loadtest_safety.ps1
[ OK ] Found scripts\validate_lan_recovery_safety.ps1
[ OK ] Found scripts\validate_institutional_receipt_print_proof.ps1
[ OK ] Found scripts\validate_maintenance_mode_safety.ps1
[ OK ] Found scripts\validate_new_invoice_maintainability.ps1
[ OK ] Found scripts\validate_shift_incident_recovery_safety.ps1
[ OK ] Found scripts\validate_final_handoff_completeness.ps1
[ OK ] Found scripts\validate_handoff_guard_coverage.ps1
[ OK ] Found scripts\validate_offline_release_staging_safety.ps1
[ OK ] Found scripts\validate_operations_objective_audit.ps1
[ OK ] Found scripts\validate_permission_audit_safety.ps1
[ OK ] Found scripts\validate_rate_limit_safety.ps1
[ OK ] Found scripts\validate_realtime_own_event_safety.ps1
[ OK ] Found scripts\validate_restore_windows_safety.ps1
[ OK ] Found scripts\validate_production_ready_gate_safety.ps1
[ OK ] Found scripts\validate_production_license_salt_guard.ps1
[ OK ] Found scripts\validate_field_proof_templates.ps1
[ OK ] Found scripts\validate_final_field_blockers_safety.ps1
[ OK ] Found scripts\validate_proof_initialization_safety.ps1
[ OK ] Found scripts\validate_first_level_support_safety.ps1
[ OK ] Found scripts\run_backup_worker.cmd
[ OK ] Found scripts\run_scheduled_backup.cmd
[ OK ] Found scripts\run_backup_scheduler_loop.ps1
[ OK ] Found scripts\start_backup_automation.cmd
[ OK ] Found qa\LAN_CLIENT_VALIDATION_PROOF.example.md
[ OK ] Found qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md
[ OK ] Found qa\FINAL_STARTUP_TASK_PROOF.example.md
[ OK ] Found qa\FINAL_RESTORE_PROOF.example.md
[ OK ] Found qa\FINAL_BACKUP_TASK_PROOF.example.md
[ OK ] Found qa\FINAL_CONCURRENCY_PROOF.example.md
[ OK ] Found qa\TRAINING_ACCEPTANCE_PROOF.example.md
[ OK ] docker-compose.prod.yml matches versioned source
[ OK ] backend\Dockerfile.prod matches versioned source
[ OK ] nginx\default.conf matches versioned source
[ OK ] nginx\hospital-common.conf matches versioned source
[FAIL] scripts\assert_offline_release_clean.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[ OK ] scripts\collect_support_packet.ps1 matches versioned source
[ OK ] scripts\deploy_hospital_lan.ps1 matches versioned source
[ OK ] scripts\init_production_proofs.ps1 matches versioned source
[FAIL] scripts\make_offline_release.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[ OK ] scripts\production_readiness_preflight.ps1 matches versioned source
[FAIL] scripts\final_production_handoff.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[ OK ] scripts\install_hospital_startup_shortcut.ps1 matches versioned source
[ OK ] scripts\install_stack_autostart_windows.ps1 matches versioned source
[ OK ] scripts\install_backup_startup_current_user.ps1 matches versioned source
[ OK ] scripts\install_backup_tasks_windows.ps1 matches versioned source
[ OK ] scripts\lib\operational_url_safety.ps1 matches versioned source
[ OK ] scripts\open_hospital_system.ps1 matches versioned source
[ OK ] scripts\repair_hospital_system.ps1 matches versioned source
[ OK ] scripts\restore_hospital_windows.ps1 matches versioned source
[ OK ] scripts\run_backup_scheduler_loop.ps1 matches versioned source
[ OK ] scripts\start_hospital_services.ps1 matches versioned source
[ OK ] scripts\start_backup_automation.cmd matches versioned source
[ OK ] scripts\validate_support_packet_safety.ps1 matches versioned source
[ OK ] scripts\validate_browser_smoke_evidence.ps1 matches versioned source
[ OK ] scripts\validate_dependency_manifest.ps1 matches versioned source
[ OK ] scripts\validate_startup_repair_safety.ps1 matches versioned source
[ OK ] scripts\validate_operator_manuals_safety.ps1 matches versioned source
[ OK ] scripts\validate_backup_restore_docs_safety.ps1 matches versioned source
[ OK ] scripts\validate_backup_startup_current_user_safety.ps1 matches versioned source
[ OK ] scripts\validate_installation_docs_safety.ps1 matches versioned source
[ OK ] scripts\validate_help_screen_safety.ps1 matches versioned source
[ OK ] scripts\validate_system_diagnostics_safety.ps1 matches versioned source
[ OK ] scripts\validate_ops_evidence_index.ps1 matches versioned source
[ OK ] scripts\validate_final_startup_task_proof.ps1 matches versioned source
[ OK ] scripts\validate_final_backup_task_proof.ps1 matches versioned source
[ OK ] scripts\validate_training_acceptance_proof.ps1 matches versioned source
[ OK ] scripts\validate_training_safety.ps1 matches versioned source
[ OK ] scripts\validate_double_action_safety.ps1 matches versioned source
[ OK ] scripts\validate_installer_legacy_safety.ps1 matches versioned source
[ OK ] scripts\validate_lan_loadtest_safety.ps1 matches versioned source
[ OK ] scripts\validate_lan_recovery_safety.ps1 matches versioned source
[ OK ] scripts\validate_institutional_receipt_print_proof.ps1 matches versioned source
[ OK ] scripts\validate_maintenance_mode_safety.ps1 matches versioned source
[ OK ] scripts\validate_new_invoice_maintainability.ps1 matches versioned source
[ OK ] scripts\validate_known_limitations_safety.ps1 matches versioned source
[ OK ] scripts\validate_shift_incident_recovery_safety.ps1 matches versioned source
[FAIL] scripts\validate_final_handoff_completeness.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\validate_handoff_guard_coverage.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[ OK ] scripts\validate_offline_release_staging_safety.ps1 matches versioned source
[FAIL] scripts\validate_operations_objective_audit.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[ OK ] scripts\validate_permission_audit_safety.ps1 matches versioned source
[ OK ] scripts\validate_rate_limit_safety.ps1 matches versioned source
[ OK ] scripts\validate_realtime_own_event_safety.ps1 matches versioned source
[ OK ] scripts\validate_restore_windows_safety.ps1 matches versioned source
[ OK ] scripts\validate_production_ready_gate_safety.ps1 matches versioned source
[ OK ] scripts\validate_production_license_salt_guard.ps1 matches versioned source
[ OK ] scripts\validate_field_proof_templates.ps1 matches versioned source
[ OK ] scripts\validate_final_field_blockers_safety.ps1 matches versioned source
[ OK ] scripts\validate_proof_initialization_safety.ps1 matches versioned source
[ OK ] scripts\validate_first_level_support_safety.ps1 matches versioned source
[ OK ] scripts\run_backup_worker.cmd matches versioned source
[ OK ] scripts\run_scheduled_backup.cmd matches versioned source
[ OK ] setup.bat matches scripts\release_setup.bat
[ OK ] setup.bat runs from its own folder
[ OK ] setup.bat launches PowerShell with -NoProfile
[ OK ] setup.bat delegates to supported LAN installer
[ OK ] setup.bat does not invoke deprecated installer
[ OK ] setup.bat avoids legacy/demo wording
[ OK ] setup.bat uses institutional wording
[ OK ] qa\LAN_CLIENT_VALIDATION_PROOF.example.md matches versioned source
[ OK ] qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md matches versioned source
[ OK ] qa\FINAL_STARTUP_TASK_PROOF.example.md matches versioned source
[ OK ] qa\FINAL_RESTORE_PROOF.example.md matches versioned source
[ OK ] qa\FINAL_BACKUP_TASK_PROOF.example.md matches versioned source
[ OK ] qa\FINAL_CONCURRENCY_PROOF.example.md matches versioned source
[ OK ] qa\TRAINING_ACCEPTANCE_PROOF.example.md matches versioned source
[ OK ] MANIFEST.txt has no stale release wording
[ OK ] MANIFEST.txt references current commit 7456a10f
[ OK ] offline-images contains 4 Docker image tar file(s)

OFFLINE_RELEASE_CLEAN: NO (7 blocking issue(s))
```

## Support packet safety validation output

```text
Paquete seguro para soporte creado en: %PROJECT_ROOT%\qa\support-packets\validation
Archivo principal: %PROJECT_ROOT%\qa\support-packets\validation\MANIFIESTO.md
[OK] SUPPORT_PACKET_SAFETY: YES
[OK] No se copiaron .env, secretos ni rutas locales reales.
```

## First-level support safety validation output

```text

== scripts\validate_operator_manuals_safety.ps1 ==
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_CAPACITACION_SEGURA.md
[ OK ] Cashier manual has daily checklist section
[ OK ] Cashier manual has delicate-action warning section
[ OK ] Cashier manual checklist has actionable checkboxes
[ OK ] Cashier manual warns before duplicate invoice/payment attempts
[ OK ] Cashier manual includes Abrir El Sistema
[ OK ] Cashier manual includes Iniciar Sesion
[ OK ] Cashier manual includes Abrir Caja
[ OK ] Cashier manual includes Crear Factura
[ OK ] Cashier manual includes Cobrar
[ OK ] Cashier manual includes Imprimir Recibo
[ OK ] Cashier manual includes Cerrar Caja
[ OK ] Cashier manual includes Si Algo Falla
[ OK ] Cashier manual blocks charging without open cashbox
[ OK ] Supervisor manual has daily checklist section
[ OK ] Supervisor manual has delicate-action warning section
[ OK ] Supervisor manual checklist has actionable checkboxes
[ OK ] Supervisor manual warns before duplicate invoice/payment attempts
[ OK ] Supervisor manual includes incident: Servidor No Disponible
[ OK ] Supervisor manual includes incident: Red Local Caida
[ OK ] Supervisor manual includes incident: Impresora No Responde
[ OK ] Supervisor manual includes incident: Caja Quedo Abierta
[ OK ] Supervisor manual includes incident: Respaldo Fallido
[ OK ] Supervisor manual includes incident: Sesion Vencida O Sin Permiso
[ OK ] Supervisor manual forbids deleting invoices
[ OK ] Administrator manual has daily checklist section
[ OK ] Administrator manual has delicate-action warning section
[ OK ] Administrator manual checklist has actionable checkboxes
[ OK ] Administrator manual warns before duplicate invoice/payment attempts
[ OK ] Administrator manual includes Usuarios Y Permisos
[ OK ] Administrator manual includes Respaldos
[ OK ] Administrator manual includes Cambios Criticos
[ OK ] Administrator manual includes Capacitacion Segura
[ OK ] Administrator manual forbids invented fiscal compliance
[ OK ] Administrator manual forbids destructive production commands
[ OK ] Operator docs include safe training/support term: base real
[ OK ] Operator docs include safe training/support term: produccion
[ OK ] Operator docs include safe training/support term: base descartable
[ OK ] Operator docs include safe training/support term: no use la base real
[ OK ] Operator docs include safe training/support term: No restaure
[ OK ] Operator docs include safe training/support term: No borre
[ OK ] Operator manuals do not expose secret-like assignments

OPERATOR_MANUALS_SAFETY: YES

== scripts\validate_shift_incident_recovery_safety.ps1 ==
[ OK ] Found frontend\src\features\help\HelpView.tsx
[ OK ] Found frontend\src\features\help\HelpView.test.tsx
[ OK ] Found frontend\src\lib\support\clientIssueLog.ts
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_CAPACITACION_SEGURA.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Help and tests cover incident: Servidor no disponible
[ OK ] Help and tests cover incident: Impresora no responde
[ OK ] Help and tests cover incident: Falla la red|Red Local Caida|red local caida
[ OK ] Help and tests cover incident: Se fue la luz|reinici
[ OK ] Help and tests cover incident: Caja qued
[ OK ] Help and tests cover incident: Respaldo fallido
[ OK ] Help and tests cover incident: Base de datos necesita restaurarse
[ OK ] Help and tests cover incident: Sesion Vencida|Sesi
[ OK ] Help and tests cover incident: Sin permiso
[ OK ] Help and tests cover incident: Se cerro el navegador|Navegador cerrado
[ OK ] Help tells staff to review cashbox and history after power/browser incidents
[ OK ] Help prevents duplicate printing/payment after printer failure
[ OK ] Help directs database restore to isolated validation first
[ OK ] Help tells staff not to use another account for permissions
[ OK ] Help keeps safe support evidence workflow
[ OK ] Help support summary warns not to repeat invoices or payments
[ OK ] Cashier manual tells staff to prepare safe help summary on errors
[ OK ] Cashier manual forbids retrying uncertain invoices or payments
[ OK ] Cashier manual requires history review before repeating work
[ OK ] Supervisor manual has real-failure section
[ OK ] Supervisor manual covers browser close without duplicate work
[ OK ] Supervisor manual covers open cashbox recovery
[ OK ] Supervisor manual covers backup failure without self-restore
[ OK ] Support guide gathers operational incident facts
[ OK ] Support guide uses safe repair diagnostics
[ OK ] Support guide uses safe support packet without secrets
[ OK ] Support guide forbids destructive first-level actions
[ OK ] Support guide requires closure checks before declaring incident resolved
[ OK ] Training guide drills real incidents before production
[ OK ] Training guide forbids production practice and destructive restore
[ OK ] Administrator manual keeps restore as authorized isolated procedure
[ OK ] Release checklist mentions shift incident recovery guard
[ OK ] Incident recovery docs do not expose secret assignments
[ OK ] Help incident guidance does not expose secret assignments

SHIFT_INCIDENT_RECOVERY_SAFETY: YES

== scripts\validate_training_safety.ps1 ==
[ OK ] Training docs forbid practicing in production
[ OK ] Training docs require isolated environment or disposable database
[ OK ] Training docs require cashier role practice
[ OK ] Training docs require supervisor role practice
[ OK ] Training docs require administrator role practice
[ OK ] Training docs require support summary practice
[ OK ] Training docs include scenario: servidor no disponible
[ OK ] Training docs include scenario: red local
[ OK ] Training docs include scenario: impresora no responde
[ OK ] Training docs include scenario: caja qued
[ OK ] Training docs include scenario: respaldo fallido
[ OK ] Training docs include scenario: sesion vencida
[ OK ] Training docs include scenario: error de permisos
[ OK ] Training docs include scenario: navegador
[ OK ] Training docs include scenario: energia
[ OK ] Training docs forbid real production users
[ OK ] Training docs forbid real patient data
[ OK ] Training docs forbid migrate fresh in production
[ OK ] Training docs forbid restoring over real database
[ OK ] Training docs forbid sharing secrets
[ OK ] Training acceptance template requires anonymous proof
[ OK ] Training acceptance template requires final conclusion
[ OK ] Training acceptance template records evidence reference
[ OK ] Training acceptance template blocks production database practice
[ OK ] Training acceptance template blocks real patient data
[ OK ] Training acceptance template covers cashier workflow
[ OK ] Training acceptance template covers supervisor incidents
[ OK ] Training acceptance template covers administrator restore safety
[ OK ] Training acceptance template preserves physical blockers
[ OK ] Training acceptance template must not contain APP_KEY-like assignments
[ OK ] Training acceptance template must not contain DB_PASSWORD-like assignments
[ OK ] Training acceptance template must not contain secret-like assignments
[ OK ] Training acceptance template must not contain absolute Windows paths
[ OK ] Help screen exposes safe training section
[ OK ] Help screen exposes practice mode warning
[ OK ] Help screen warns not to use production database
[ OK ] Help screen mentions isolated practice database
[ OK ] HelpView test protects production database warning

TRAINING_SAFETY: YES

== scripts\validate_support_packet_safety.ps1 ==
Paquete seguro para soporte creado en: %PROJECT_ROOT%\qa\support-packets\validation
Archivo principal: %PROJECT_ROOT%\qa\support-packets\validation\MANIFIESTO.md
[OK] SUPPORT_PACKET_SAFETY: YES
[OK] No se copiaron .env, secretos ni rutas locales reales.

== scripts\validate_final_field_blockers_safety.ps1 ==
[ OK ] SelfTest accepts printer proof that preserves all required institutional paper blockers
[ OK ] SelfTest rejects printer proof missing required institutional paper blockers

FINAL_FIELD_BLOCKERS_SAFETY_SELFTEST: YES

[INFO] Final-field proof live validation was skipped. Run with -IncludeFieldProofs on the final server when physical evidence is ready.

FIRST_LEVEL_SUPPORT_SAFETY: YES
```

## Production ready gate safety validation output

```text
[ OK ] Found scripts\production_readiness_preflight.ps1
[ OK ] Found scripts\final_production_handoff.ps1
[ OK ] Found scripts\validate_ops_evidence_index.ps1
[ OK ] Found scripts\validate_final_handoff_completeness.ps1
[ OK ] Preflight exposes AllowMissingPhysicalProof as an explicit switch
[ OK ] Preflight fails when physical proof is bypassed
[ OK ] Preflight warns that bypass cannot be PRODUCTION_READY
[ OK ] Preflight requires qa\LAN_CLIENT_VALIDATION_PROOF.md
[ OK ] Ops evidence index inspects qa\LAN_CLIENT_VALIDATION_PROOF.md before PRODUCTION_READY
[ OK ] Preflight requires qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md
[ OK ] Ops evidence index inspects qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md before PRODUCTION_READY
[ OK ] Preflight requires qa\FINAL_STARTUP_TASK_PROOF.md
[ OK ] Ops evidence index inspects qa\FINAL_STARTUP_TASK_PROOF.md before PRODUCTION_READY
[ OK ] Preflight requires qa\FINAL_RESTORE_PROOF.md
[ OK ] Ops evidence index inspects qa\FINAL_RESTORE_PROOF.md before PRODUCTION_READY
[ OK ] Preflight requires qa\FINAL_BACKUP_TASK_PROOF.md
[ OK ] Ops evidence index inspects qa\FINAL_BACKUP_TASK_PROOF.md before PRODUCTION_READY
[ OK ] Preflight requires qa\FINAL_CONCURRENCY_PROOF.md
[ OK ] Ops evidence index inspects qa\FINAL_CONCURRENCY_PROOF.md before PRODUCTION_READY
[ OK ] Preflight requires qa\TRAINING_ACCEPTANCE_PROOF.md
[ OK ] Ops evidence index inspects qa\TRAINING_ACCEPTANCE_PROOF.md before PRODUCTION_READY
[ OK ] Preflight rejects incomplete proof marker \bTODO\b
[ OK ] Preflight rejects incomplete proof marker \bPENDING_[A-Z_]+\b
[ OK ] Preflight rejects incomplete proof marker \bREPLACE\b
[ OK ] Preflight rejects incomplete proof marker \bN/A\b
[ OK ] Preflight rejects incomplete proof marker \bTBD\b
[ OK ] Preflight rejects incomplete proof marker example
[ OK ] Preflight rejects incomplete proof marker template
[ OK ] Preflight rejects incomplete proof marker use this file
[ OK ] Preflight rejects incomplete proof marker \[ \]
[ OK ] Preflight keeps required proof check: /up
[ OK ] Preflight keeps required proof check: Cashbox
[ OK ] Preflight keeps required proof check: Invoice
[ OK ] Preflight keeps required proof check: Payment
[ OK ] Preflight keeps required proof check: Receipt
[ OK ] Preflight keeps required proof check: AtStartup
[ OK ] Preflight keeps required proof check: Backup
[ OK ] Preflight keeps required proof check: pending to success
[ OK ] Preflight keeps required proof check: media carta
[ OK ] Preflight keeps required proof check: carta
[ OK ] Preflight keeps required proof check: A5
[ OK ] Preflight keeps required proof check: Disposable restore database
[ OK ] Preflight keeps required proof check: Concurrent invoice emission
[ OK ] Preflight keeps required proof check: supervised training acceptance
[ OK ] Preflight keeps required proof check: Training did not use the production database
[ OK ] Final handoff keeps gate term: $allProofsCompleted
[ OK ] Final handoff keeps gate term: $allAutomatedGuardsPassed
[ OK ] Final handoff keeps gate term: -not $preflightSkipped
[ OK ] Final handoff keeps gate term: $preflightExit -eq 0
[ OK ] Final handoff keeps gate term: PRODUCTION_READY evidence gate passed
[ OK ] Final handoff keeps gate term: PRODUCTION_READY remains blocked
[ OK ] Ops evidence index blocks PRODUCTION_READY with incomplete proof markers
[ OK ] Ops evidence index requires the preflight in the handoff
[ OK ] Handoff completeness requires PRODUCTION_CANDIDATE until field proof is complete

PRODUCTION_READY_GATE_SAFETY: YES
```

## Final field blockers safety self-test output

```text
[ OK ] SelfTest accepts printer proof that preserves all required institutional paper blockers
[ OK ] SelfTest rejects printer proof missing required institutional paper blockers

FINAL_FIELD_BLOCKERS_SAFETY_SELFTEST: YES
```

## Browser smoke evidence validation output

```text
[ OK ] Found qa\browser-smoke-2026-06-03\rc-e2e-mocked-report.json
[ OK ] Found qa\screenshots\rc-help-support-2026-05-31\help-support-report.json
[ OK ] RC browser smoke declares mocked-e2e mode
[ OK ] RC browser smoke states it does not replace LAN/printer proof
[ OK ] RC browser smoke has no console issues
[ OK ] RC browser smoke metadata matches dashboard-light
[ OK ] RC browser smoke dashboard-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches dashboard-dark
[ OK ] RC browser smoke dashboard-dark screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches cashbox-open-light
[ OK ] RC browser smoke cashbox-open-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches billing-new-empty-light
[ OK ] RC browser smoke billing-new-empty-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches billing-new-cart-light
[ OK ] RC browser smoke billing-new-cart-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches receipt-preview-a5-light
[ OK ] RC browser smoke receipt-preview-a5-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches receipt-preview-light
[ OK ] RC browser smoke receipt-preview-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches receipt-preview-dark
[ OK ] RC browser smoke receipt-preview-dark screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches reports-admin-light
[ OK ] RC browser smoke reports-admin-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches backups-pending-light
[ OK ] RC browser smoke backups-pending-light screenshot exists and is non-empty
[ OK ] Help/support smoke has no console issues
[ OK ] Help/support light capture records safe support evidence without secret words
[ OK ] Help/support light screenshot exists and is non-empty
[ OK ] Help/support dark capture records safe support evidence without secret words
[ OK ] Help/support dark screenshot exists and is non-empty

BROWSER_SMOKE_EVIDENCE: YES
```

## Startup and repair safety validation output

```text
[ OK ] Found scripts\start_hospital_services.ps1
[ OK ] Found scripts\repair_hospital_system.ps1
[ OK ] Found scripts\open_hospital_system.ps1
[ OK ] Found scripts\install_hospital_startup_shortcut.ps1
[ OK ] Found scripts\install_stack_autostart_windows.ps1
[ OK ] Found scripts\install_backup_tasks_windows.ps1
[ OK ] Found scripts\final_production_handoff.ps1
[ OK ] Found scripts\production_readiness_preflight.ps1
[ OK ] scripts\start_hospital_services.ps1 includes human safety warning
[ OK ] scripts\repair_hospital_system.ps1 includes human safety warning
[ OK ] scripts\open_hospital_system.ps1 includes human safety warning
[ OK ] scripts\final_production_handoff.ps1 uses -NoProfile for nested PowerShell calls
[ OK ] scripts\production_readiness_preflight.ps1 uses -NoProfile for nested PowerShell calls
[ OK ] scripts\install_stack_autostart_windows.ps1 uses -NoProfile for nested PowerShell calls
[ OK ] scripts\install_backup_tasks_windows.ps1 uses -NoProfile for nested PowerShell calls
Iniciando servicios locales del Sistema de Caja Hospitalaria...
Carpeta del sistema: %PROJECT_ROOT%
Validacion de arranque completada.
Modo Docker detectado: development-docker.
Servicios que se solicitarian: backend, frontend, mysql.
Modo WhatIf: no se levanta Docker y no se modifican contenedores.
[ OK ] Startup dry run completed in safe mode
Validacion de reparacion segura completada.
Modo WhatIf: no se levanta Docker, no se abre navegador y no se escribe diagnostico.
Ruta de diagnostico validada dentro del sistema instalado.
Modo Docker detectado: development-docker.
Servicios que se solicitarian: backend, frontend, mysql.
URL que se revisaria: http://127.0.0.1:8000.
[ OK ] Repair dry run completed in safe mode
Validacion del acceso directo completada.
Carpeta del sistema: %PROJECT_ROOT%
Destino del acceso directo: %USERPROFILE%\OneDrive\Desktop\Abrir Sistema de Caja Hospitalaria.lnk
Modo WhatIf: no se creo acceso directo ni tarea de inicio.
[ OK ] Shortcut dry run completed in safe mode
Preparando autoarranque del Sistema de Caja Hospitalaria.
Instalacion: %PROJECT_ROOT%
Tarea: SistemaCajaHospitalaria-StackAutostart
Accion: powershell.exe -NoProfile -ExecutionPolicy Bypass -File %PROJECT_ROOT%\scripts\start_hospital_services.ps1
Modo WhatIf: no se registro, actualizo ni elimino la tarea de autoarranque.
Trigger previsto: AtStartup.
Para instalar o actualizar use PowerShell como Administrador con: -UpdateExisting
Para revisar estado use: -Status
[ OK ] Stack autostart dry run completed in safe mode
Preparando tareas programadas de respaldos para Sistema de Caja Hospitalaria.
Instalacion: %PROJECT_ROOT%
Modo: PATH del sistema
Worker: %PROJECT_ROOT%\scripts\run_backup_worker.cmd
Respaldo diario: %PROJECT_ROOT%\scripts\run_scheduled_backup.cmd
Tarea worker: SistemaCajaHospitalaria-BackupWorker
Tarea diaria: SistemaCajaHospitalaria-DailyBackup a las 23:30
Modo WhatIf: no se registraron, actualizaron ni eliminaron tareas.
Comando worker previsto: cmd.exe /c "%PROJECT_ROOT%\scripts\run_backup_worker.cmd" "[php-configurado]"
Comando respaldo diario previsto: cmd.exe /c "%PROJECT_ROOT%\scripts\run_scheduled_backup.cmd" "[php-configurado]"
Para actualizar tareas existentes use: -UpdateExisting
Para remover tareas use: -Uninstall
Para revisar estado use: -Status
[ OK ] Backup task dry run completed in safe mode

STARTUP_REPAIR_SAFETY: YES
```

## Training safety validation output

```text
[ OK ] Training docs forbid practicing in production
[ OK ] Training docs require isolated environment or disposable database
[ OK ] Training docs require cashier role practice
[ OK ] Training docs require supervisor role practice
[ OK ] Training docs require administrator role practice
[ OK ] Training docs require support summary practice
[ OK ] Training docs include scenario: servidor no disponible
[ OK ] Training docs include scenario: red local
[ OK ] Training docs include scenario: impresora no responde
[ OK ] Training docs include scenario: caja qued
[ OK ] Training docs include scenario: respaldo fallido
[ OK ] Training docs include scenario: sesion vencida
[ OK ] Training docs include scenario: error de permisos
[ OK ] Training docs include scenario: navegador
[ OK ] Training docs include scenario: energia
[ OK ] Training docs forbid real production users
[ OK ] Training docs forbid real patient data
[ OK ] Training docs forbid migrate fresh in production
[ OK ] Training docs forbid restoring over real database
[ OK ] Training docs forbid sharing secrets
[ OK ] Training acceptance template requires anonymous proof
[ OK ] Training acceptance template requires final conclusion
[ OK ] Training acceptance template records evidence reference
[ OK ] Training acceptance template blocks production database practice
[ OK ] Training acceptance template blocks real patient data
[ OK ] Training acceptance template covers cashier workflow
[ OK ] Training acceptance template covers supervisor incidents
[ OK ] Training acceptance template covers administrator restore safety
[ OK ] Training acceptance template preserves physical blockers
[ OK ] Training acceptance template must not contain APP_KEY-like assignments
[ OK ] Training acceptance template must not contain DB_PASSWORD-like assignments
[ OK ] Training acceptance template must not contain secret-like assignments
[ OK ] Training acceptance template must not contain absolute Windows paths
[ OK ] Help screen exposes safe training section
[ OK ] Help screen exposes practice mode warning
[ OK ] Help screen warns not to use production database
[ OK ] Help screen mentions isolated practice database
[ OK ] HelpView test protects production database warning

TRAINING_SAFETY: YES
```

## Field proof templates safety validation output

```text
[ OK ] qa\LAN_CLIENT_VALIDATION_PROOF.example.md keeps required fields, checks and safety instructions.
[ OK ] qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md keeps required fields, checks and safety instructions.
[ OK ] qa\FINAL_RESTORE_PROOF.example.md keeps required fields, checks and safety instructions.
[ OK ] qa\FINAL_STARTUP_TASK_PROOF.example.md keeps required fields, checks and safety instructions.
[ OK ] qa\FINAL_BACKUP_TASK_PROOF.example.md keeps required fields, checks and safety instructions.
[ OK ] qa\FINAL_CONCURRENCY_PROOF.example.md keeps required fields, checks and safety instructions.
[ OK ] qa\TRAINING_ACCEPTANCE_PROOF.example.md keeps required fields, checks and safety instructions.

FIELD_PROOF_TEMPLATES: YES
Final-field proof templates match preflight-required labels, checks and safety instructions.
```

## Proof initialization safety validation output

```text
[ OK ] Found scripts\init_production_proofs.ps1
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found scripts\final_production_handoff.ps1
[ OK ] Found scripts\make_offline_release.ps1
[ OK ] Found scripts\assert_offline_release_clean.ps1
[ OK ] Initializer includes LAN_CLIENT_VALIDATION_PROOF example template
[ OK ] Initializer includes LAN_CLIENT_VALIDATION_PROOF target proof
[ OK ] Offline builder includes LAN_CLIENT_VALIDATION_PROOF example template
[ OK ] Offline guard requires LAN_CLIENT_VALIDATION_PROOF example template
[ OK ] Initializer includes INSTITUTIONAL_RECEIPT_PRINT_PROOF example template
[ OK ] Initializer includes INSTITUTIONAL_RECEIPT_PRINT_PROOF target proof
[ OK ] Offline builder includes INSTITUTIONAL_RECEIPT_PRINT_PROOF example template
[ OK ] Offline guard requires INSTITUTIONAL_RECEIPT_PRINT_PROOF example template
[ OK ] Initializer includes FINAL_STARTUP_TASK_PROOF example template
[ OK ] Initializer includes FINAL_STARTUP_TASK_PROOF target proof
[ OK ] Offline builder includes FINAL_STARTUP_TASK_PROOF example template
[ OK ] Offline guard requires FINAL_STARTUP_TASK_PROOF example template
[ OK ] Initializer includes FINAL_RESTORE_PROOF example template
[ OK ] Initializer includes FINAL_RESTORE_PROOF target proof
[ OK ] Offline builder includes FINAL_RESTORE_PROOF example template
[ OK ] Offline guard requires FINAL_RESTORE_PROOF example template
[ OK ] Initializer includes FINAL_BACKUP_TASK_PROOF example template
[ OK ] Initializer includes FINAL_BACKUP_TASK_PROOF target proof
[ OK ] Offline builder includes FINAL_BACKUP_TASK_PROOF example template
[ OK ] Offline guard requires FINAL_BACKUP_TASK_PROOF example template
[ OK ] Initializer includes FINAL_CONCURRENCY_PROOF example template
[ OK ] Initializer includes FINAL_CONCURRENCY_PROOF target proof
[ OK ] Offline builder includes FINAL_CONCURRENCY_PROOF example template
[ OK ] Offline guard requires FINAL_CONCURRENCY_PROOF example template
[ OK ] Initializer includes TRAINING_ACCEPTANCE_PROOF example template
[ OK ] Initializer includes TRAINING_ACCEPTANCE_PROOF target proof
[ OK ] Offline builder includes TRAINING_ACCEPTANCE_PROOF example template
[ OK ] Offline guard requires TRAINING_ACCEPTANCE_PROOF example template
[ OK ] Initializer supports WhatIfOnly
[ OK ] Initializer protects existing evidence unless Force is passed
[ OK ] Initializer sanitizes local paths in output
[ OK ] Final handoff exposes InitializeProofFiles switch
[ OK ] Final handoff calls proof initializer with ProjectRoot
[ OK ] Release checklist documents proof initialization
[ OK ] Install guide documents proof initialization dry-run
[ OK ] Install guide documents guided handoff proof initialization
[ OK ] Initializer does not run destructive database commands
[ OK ] Proof initializer WhatIf succeeds against disposable fixture
[ OK ] Proof initializer WhatIf does not create proof files
[ OK ] Proof initializer creates missing proof files in disposable fixture
[ OK ] Proof initializer created qa\LAN_CLIENT_VALIDATION_PROOF.md
[ OK ] Proof initializer created qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md
[ OK ] Proof initializer created qa\FINAL_STARTUP_TASK_PROOF.md
[ OK ] Proof initializer created qa\FINAL_RESTORE_PROOF.md
[ OK ] Proof initializer created qa\FINAL_BACKUP_TASK_PROOF.md
[ OK ] Proof initializer created qa\FINAL_CONCURRENCY_PROOF.md
[ OK ] Proof initializer created qa\TRAINING_ACCEPTANCE_PROOF.md
[ OK ] Proof initializer exits successfully when proof files already exist
[ OK ] Proof initializer preserves existing proof files without Force
[ OK ] Proof initializer output sanitizes local fixture paths

PROOF_INITIALIZATION_SAFETY: YES
Proof initialization creates missing final-evidence templates without overwriting existing evidence.
```

## Operations objective audit validation output

```text
[OK] OPERATIONS_OBJECTIVE_AUDIT: YES
[OK] Objective requirements are traced to evidence and final-field blockers remain explicit.
```

## Handoff guard coverage validation output

```text
[ OK ] Found scripts\final_production_handoff.ps1
[ OK ] Found scripts\make_offline_release.ps1
[ OK ] Found scripts\assert_offline_release_clean.ps1
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Final handoff declares 44 script dependency/dependencies
[ OK ] Handoff dependency exists: scripts\assert_offline_release_clean.ps1
[ OK ] Offline builder critical scripts include assert_offline_release_clean.ps1
[ OK ] Offline guard requires scripts\assert_offline_release_clean.ps1
[ OK ] Offline guard compares scripts\assert_offline_release_clean.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\init_production_proofs.ps1
[ OK ] Offline builder critical scripts include init_production_proofs.ps1
[ OK ] Offline guard requires scripts\init_production_proofs.ps1
[ OK ] Offline guard compares scripts\init_production_proofs.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\install_backup_tasks_windows.ps1
[ OK ] Offline builder critical scripts include install_backup_tasks_windows.ps1
[ OK ] Offline guard requires scripts\install_backup_tasks_windows.ps1
[ OK ] Offline guard compares scripts\install_backup_tasks_windows.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\make_offline_release.ps1
[ OK ] Offline builder critical scripts include make_offline_release.ps1
[ OK ] Offline guard requires scripts\make_offline_release.ps1
[ OK ] Offline guard compares scripts\make_offline_release.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\production_readiness_preflight.ps1
[ OK ] Offline builder critical scripts include production_readiness_preflight.ps1
[ OK ] Offline guard requires scripts\production_readiness_preflight.ps1
[ OK ] Offline guard compares scripts\production_readiness_preflight.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_backup_restore_docs_safety.ps1
[ OK ] Offline builder critical scripts include validate_backup_restore_docs_safety.ps1
[ OK ] Offline guard requires scripts\validate_backup_restore_docs_safety.ps1
[ OK ] Offline guard compares scripts\validate_backup_restore_docs_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_backup_startup_current_user_safety.ps1
[ OK ] Offline builder critical scripts include validate_backup_startup_current_user_safety.ps1
[ OK ] Offline guard requires scripts\validate_backup_startup_current_user_safety.ps1
[ OK ] Offline guard compares scripts\validate_backup_startup_current_user_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_browser_smoke_evidence.ps1
[ OK ] Offline builder critical scripts include validate_browser_smoke_evidence.ps1
[ OK ] Offline guard requires scripts\validate_browser_smoke_evidence.ps1
[ OK ] Offline guard compares scripts\validate_browser_smoke_evidence.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_dependency_manifest.ps1
[ OK ] Offline builder critical scripts include validate_dependency_manifest.ps1
[ OK ] Offline guard requires scripts\validate_dependency_manifest.ps1
[ OK ] Offline guard compares scripts\validate_dependency_manifest.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_double_action_safety.ps1
[ OK ] Offline builder critical scripts include validate_double_action_safety.ps1
[ OK ] Offline guard requires scripts\validate_double_action_safety.ps1
[ OK ] Offline guard compares scripts\validate_double_action_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_field_proof_templates.ps1
[ OK ] Offline builder critical scripts include validate_field_proof_templates.ps1
[ OK ] Offline guard requires scripts\validate_field_proof_templates.ps1
[ OK ] Offline guard compares scripts\validate_field_proof_templates.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_final_backup_task_proof.ps1
[ OK ] Offline builder critical scripts include validate_final_backup_task_proof.ps1
[ OK ] Offline guard requires scripts\validate_final_backup_task_proof.ps1
[ OK ] Offline guard compares scripts\validate_final_backup_task_proof.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_final_field_blockers_safety.ps1
[ OK ] Offline builder critical scripts include validate_final_field_blockers_safety.ps1
[ OK ] Offline guard requires scripts\validate_final_field_blockers_safety.ps1
[ OK ] Offline guard compares scripts\validate_final_field_blockers_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_final_handoff_completeness.ps1
[ OK ] Offline builder critical scripts include validate_final_handoff_completeness.ps1
[ OK ] Offline guard requires scripts\validate_final_handoff_completeness.ps1
[ OK ] Offline guard compares scripts\validate_final_handoff_completeness.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_final_startup_task_proof.ps1
[ OK ] Offline builder critical scripts include validate_final_startup_task_proof.ps1
[ OK ] Offline guard requires scripts\validate_final_startup_task_proof.ps1
[ OK ] Offline guard compares scripts\validate_final_startup_task_proof.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_first_level_support_safety.ps1
[ OK ] Offline builder critical scripts include validate_first_level_support_safety.ps1
[ OK ] Offline guard requires scripts\validate_first_level_support_safety.ps1
[ OK ] Offline guard compares scripts\validate_first_level_support_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_handoff_guard_coverage.ps1
[ OK ] Offline builder critical scripts include validate_handoff_guard_coverage.ps1
[ OK ] Offline guard requires scripts\validate_handoff_guard_coverage.ps1
[ OK ] Offline guard compares scripts\validate_handoff_guard_coverage.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_help_screen_safety.ps1
[ OK ] Offline builder critical scripts include validate_help_screen_safety.ps1
[ OK ] Offline guard requires scripts\validate_help_screen_safety.ps1
[ OK ] Offline guard compares scripts\validate_help_screen_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_installation_docs_safety.ps1
[ OK ] Offline builder critical scripts include validate_installation_docs_safety.ps1
[ OK ] Offline guard requires scripts\validate_installation_docs_safety.ps1
[ OK ] Offline guard compares scripts\validate_installation_docs_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_installer_legacy_safety.ps1
[ OK ] Offline builder critical scripts include validate_installer_legacy_safety.ps1
[ OK ] Offline guard requires scripts\validate_installer_legacy_safety.ps1
[ OK ] Offline guard compares scripts\validate_installer_legacy_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_institutional_receipt_print_proof.ps1
[ OK ] Offline builder critical scripts include validate_institutional_receipt_print_proof.ps1
[ OK ] Offline guard requires scripts\validate_institutional_receipt_print_proof.ps1
[ OK ] Offline guard compares scripts\validate_institutional_receipt_print_proof.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_known_limitations_safety.ps1
[ OK ] Offline builder critical scripts include validate_known_limitations_safety.ps1
[ OK ] Offline guard requires scripts\validate_known_limitations_safety.ps1
[ OK ] Offline guard compares scripts\validate_known_limitations_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_lan_client_proof.ps1
[ OK ] Offline builder critical scripts include validate_lan_client_proof.ps1
[ OK ] Offline guard requires scripts\validate_lan_client_proof.ps1
[ OK ] Offline guard compares scripts\validate_lan_client_proof.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_lan_loadtest_safety.ps1
[ OK ] Offline builder critical scripts include validate_lan_loadtest_safety.ps1
[ OK ] Offline guard requires scripts\validate_lan_loadtest_safety.ps1
[ OK ] Offline guard compares scripts\validate_lan_loadtest_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_lan_recovery_safety.ps1
[ OK ] Offline builder critical scripts include validate_lan_recovery_safety.ps1
[ OK ] Offline guard requires scripts\validate_lan_recovery_safety.ps1
[ OK ] Offline guard compares scripts\validate_lan_recovery_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_maintenance_mode_safety.ps1
[ OK ] Offline builder critical scripts include validate_maintenance_mode_safety.ps1
[ OK ] Offline guard requires scripts\validate_maintenance_mode_safety.ps1
[ OK ] Offline guard compares scripts\validate_maintenance_mode_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_new_invoice_maintainability.ps1
[ OK ] Offline builder critical scripts include validate_new_invoice_maintainability.ps1
[ OK ] Offline guard requires scripts\validate_new_invoice_maintainability.ps1
[ OK ] Offline guard compares scripts\validate_new_invoice_maintainability.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_offline_release_staging_safety.ps1
[ OK ] Offline builder critical scripts include validate_offline_release_staging_safety.ps1
[ OK ] Offline guard requires scripts\validate_offline_release_staging_safety.ps1
[ OK ] Offline guard compares scripts\validate_offline_release_staging_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_operations_objective_audit.ps1
[ OK ] Offline builder critical scripts include validate_operations_objective_audit.ps1
[ OK ] Offline guard requires scripts\validate_operations_objective_audit.ps1
[ OK ] Offline guard compares scripts\validate_operations_objective_audit.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_operator_manuals_safety.ps1
[ OK ] Offline builder critical scripts include validate_operator_manuals_safety.ps1
[ OK ] Offline guard requires scripts\validate_operator_manuals_safety.ps1
[ OK ] Offline guard compares scripts\validate_operator_manuals_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_ops_evidence_index.ps1
[ OK ] Offline builder critical scripts include validate_ops_evidence_index.ps1
[ OK ] Offline guard requires scripts\validate_ops_evidence_index.ps1
[ OK ] Offline guard compares scripts\validate_ops_evidence_index.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_permission_audit_safety.ps1
[ OK ] Offline builder critical scripts include validate_permission_audit_safety.ps1
[ OK ] Offline guard requires scripts\validate_permission_audit_safety.ps1
[ OK ] Offline guard compares scripts\validate_permission_audit_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_production_license_salt_guard.ps1
[ OK ] Offline builder critical scripts include validate_production_license_salt_guard.ps1
[ OK ] Offline guard requires scripts\validate_production_license_salt_guard.ps1
[ OK ] Offline guard compares scripts\validate_production_license_salt_guard.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_production_ready_gate_safety.ps1
[ OK ] Offline builder critical scripts include validate_production_ready_gate_safety.ps1
[ OK ] Offline guard requires scripts\validate_production_ready_gate_safety.ps1
[ OK ] Offline guard compares scripts\validate_production_ready_gate_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_proof_initialization_safety.ps1
[ OK ] Offline builder critical scripts include validate_proof_initialization_safety.ps1
[ OK ] Offline guard requires scripts\validate_proof_initialization_safety.ps1
[ OK ] Offline guard compares scripts\validate_proof_initialization_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_rate_limit_safety.ps1
[ OK ] Offline builder critical scripts include validate_rate_limit_safety.ps1
[ OK ] Offline guard requires scripts\validate_rate_limit_safety.ps1
[ OK ] Offline guard compares scripts\validate_rate_limit_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_realtime_own_event_safety.ps1
[ OK ] Offline builder critical scripts include validate_realtime_own_event_safety.ps1
[ OK ] Offline guard requires scripts\validate_realtime_own_event_safety.ps1
[ OK ] Offline guard compares scripts\validate_realtime_own_event_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_restore_windows_safety.ps1
[ OK ] Offline builder critical scripts include validate_restore_windows_safety.ps1
[ OK ] Offline guard requires scripts\validate_restore_windows_safety.ps1
[ OK ] Offline guard compares scripts\validate_restore_windows_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_shift_incident_recovery_safety.ps1
[ OK ] Offline builder critical scripts include validate_shift_incident_recovery_safety.ps1
[ OK ] Offline guard requires scripts\validate_shift_incident_recovery_safety.ps1
[ OK ] Offline guard compares scripts\validate_shift_incident_recovery_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_startup_repair_safety.ps1
[ OK ] Offline builder critical scripts include validate_startup_repair_safety.ps1
[ OK ] Offline guard requires scripts\validate_startup_repair_safety.ps1
[ OK ] Offline guard compares scripts\validate_startup_repair_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_support_packet_safety.ps1
[ OK ] Offline builder critical scripts include validate_support_packet_safety.ps1
[ OK ] Offline guard requires scripts\validate_support_packet_safety.ps1
[ OK ] Offline guard compares scripts\validate_support_packet_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_system_diagnostics_safety.ps1
[ OK ] Offline builder critical scripts include validate_system_diagnostics_safety.ps1
[ OK ] Offline guard requires scripts\validate_system_diagnostics_safety.ps1
[ OK ] Offline guard compares scripts\validate_system_diagnostics_safety.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_training_acceptance_proof.ps1
[ OK ] Offline builder critical scripts include validate_training_acceptance_proof.ps1
[ OK ] Offline guard requires scripts\validate_training_acceptance_proof.ps1
[ OK ] Offline guard compares scripts\validate_training_acceptance_proof.ps1 with versioned source
[ OK ] Handoff dependency exists: scripts\validate_training_safety.ps1
[ OK ] Offline builder critical scripts include validate_training_safety.ps1
[ OK ] Offline guard requires scripts\validate_training_safety.ps1
[ OK ] Offline guard compares scripts\validate_training_safety.ps1 with versioned source
[ OK ] Release checklist mentions validate_handoff_guard_coverage.ps1
[ OK ] Release checklist mentions validate_offline_release_staging_safety.ps1
[ OK ] Release checklist mentions validate_lan_client_proof.ps1
[ OK ] Release checklist mentions validate_lan_loadtest_safety.ps1
[ OK ] Release checklist mentions validate_realtime_own_event_safety.ps1
[ OK ] Release checklist mentions validate_training_acceptance_proof.ps1
[ OK ] Release checklist mentions validate_restore_windows_safety.ps1
[ OK ] Release checklist mentions validate_production_license_salt_guard.ps1
[ OK ] Release checklist mentions validate_final_handoff_completeness.ps1
[ OK ] Release checklist mentions validate_ops_evidence_index.ps1
[ OK ] Release checklist mentions assert_offline_release_clean.ps1 -SelfTest
[ OK ] Final handoff does not expose secret-like assignments
[ OK ] Offline builder coverage source avoids destructive reset patterns

HANDOFF_GUARD_COVERAGE: YES
```

## Offline release staging safety validation output

```text
[ OK ] Found scripts\make_offline_release.ps1
[ OK ] Builder keeps final release path separate from staging path
[ OK ] Builder defines a staging release path
[ OK ] Builder creates a named staging directory
[ OK ] Builder has staging cleanup helper
[ OK ] Builder cleans staging before failing
[ OK ] Builder creates a temporary backup path before final swap
[ OK ] Builder moves previous release to backup before publishing
[ OK ] Builder publishes staged release after validation
[ OK ] Builder restores previous release if publish fails
[ OK ] Builder runs offline release guard before publishing final release
[ OK ] Builder avoids deleting the previous final release before publish

OFFLINE_RELEASE_STAGING_SAFETY: YES
```

## Offline release builder self-test output

```text
[OK] SelfTest passed. default.conf=79 lines, crontab=10 lines, scripts=61, docs=7, proofTemplates=7, hash=ED8CCC2747A4CC0197054B68E5A7059E0AC115BDF8B85113C80701EA77B54E79
```

## Offline release guard self-test output

```text
[OK] SelfTest passed. Only final-field qa/*.example.md templates are allowed in offline release.
```

## Dependency manifest validation output

```text
Manifest matches composer.json and package.json.
  backend deps declared: 15
  frontend deps declared: 48
```

## Production license salt guard validation output

```text
[ OK ] Found backend\app\Providers\AppServiceProvider.php
[ OK ] Found backend\config\app.php
[ OK ] Found backend\tests\Unit\LicenseSaltGuardTest.php
[ OK ] Found docker-compose.prod.yml
[ OK ] Found scripts\pre-commit-guard.ps1
[ OK ] Found docs\SECRETS.md
[ OK ] Found docs\KNOWN_LIMITATIONS.md
[ OK ] Found qa\PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md
[ OK ] Provider enforces 32-character minimum
[ OK ] Provider reads app license_salt config
[ OK ] Provider allows non-production environments
[ OK ] Provider throws a production boot exception
[ OK ] Provider has human production error
[ OK ] Config maps HOSPITAL_LICENSE_SALT without committed fallback
[ OK ] Unit test keeps testing usable
[ OK ] Unit test rejects short production salt
[ OK ] Unit test rejects missing production salt
[ OK ] Unit test accepts long production salt
[ OK ] Production compose requires HOSPITAL_LICENSE_SALT for backend and scheduler
[ OK ] Pre-commit guard documents license salt secret blocking
[ OK ] Pre-commit guard scans added license salt assignments
[ OK ] Docs/evidence mention HOSPITAL_LICENSE_SALT
[ OK ] Docs/evidence require 32+ character salt
[ OK ] Docs/evidence warn not to commit or print real salt
[ OK ] Production compose with placeholder salt completed with expected compose behavior
error while interpolating services.scheduler.environment.HOSPITAL_LICENSE_SALT=[redacted] variable HOSPITAL_LICENSE_SALT is missing a value: HOSPITAL_LICENSE_SALT must be set to a 32+ char random string
[ OK ] Production compose without license salt completed with expected compose behavior

PRODUCTION_LICENSE_SALT_GUARD: YES
```

## Operator manuals safety validation output

```text
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_CAPACITACION_SEGURA.md
[ OK ] Cashier manual has daily checklist section
[ OK ] Cashier manual has delicate-action warning section
[ OK ] Cashier manual checklist has actionable checkboxes
[ OK ] Cashier manual warns before duplicate invoice/payment attempts
[ OK ] Cashier manual includes Abrir El Sistema
[ OK ] Cashier manual includes Iniciar Sesion
[ OK ] Cashier manual includes Abrir Caja
[ OK ] Cashier manual includes Crear Factura
[ OK ] Cashier manual includes Cobrar
[ OK ] Cashier manual includes Imprimir Recibo
[ OK ] Cashier manual includes Cerrar Caja
[ OK ] Cashier manual includes Si Algo Falla
[ OK ] Cashier manual blocks charging without open cashbox
[ OK ] Supervisor manual has daily checklist section
[ OK ] Supervisor manual has delicate-action warning section
[ OK ] Supervisor manual checklist has actionable checkboxes
[ OK ] Supervisor manual warns before duplicate invoice/payment attempts
[ OK ] Supervisor manual includes incident: Servidor No Disponible
[ OK ] Supervisor manual includes incident: Red Local Caida
[ OK ] Supervisor manual includes incident: Impresora No Responde
[ OK ] Supervisor manual includes incident: Caja Quedo Abierta
[ OK ] Supervisor manual includes incident: Respaldo Fallido
[ OK ] Supervisor manual includes incident: Sesion Vencida O Sin Permiso
[ OK ] Supervisor manual forbids deleting invoices
[ OK ] Administrator manual has daily checklist section
[ OK ] Administrator manual has delicate-action warning section
[ OK ] Administrator manual checklist has actionable checkboxes
[ OK ] Administrator manual warns before duplicate invoice/payment attempts
[ OK ] Administrator manual includes Usuarios Y Permisos
[ OK ] Administrator manual includes Respaldos
[ OK ] Administrator manual includes Cambios Criticos
[ OK ] Administrator manual includes Capacitacion Segura
[ OK ] Administrator manual forbids invented fiscal compliance
[ OK ] Administrator manual forbids destructive production commands
[ OK ] Operator docs include safe training/support term: base real
[ OK ] Operator docs include safe training/support term: produccion
[ OK ] Operator docs include safe training/support term: base descartable
[ OK ] Operator docs include safe training/support term: no use la base real
[ OK ] Operator docs include safe training/support term: No restaure
[ OK ] Operator docs include safe training/support term: No borre
[ OK ] Operator manuals do not expose secret-like assignments

OPERATOR_MANUALS_SAFETY: YES
```

## Backup and restore docs safety validation output

```text
[ OK ] Found docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Backup/restore guide includes Crear Respaldo Manual
[ OK ] Backup/restore guide includes Respaldos Automaticos
[ OK ] Backup/restore guide includes Retencion de respaldos
[ OK ] Backup/restore guide includes validate_backup_worker_smoke.ps1
[ OK ] Backup/restore guide includes qa\BACKUP_WORKER_SMOKE_PROOF.md
[ OK ] Backup/restore guide includes qa\FINAL_BACKUP_TASK_PROOF.md
[ OK ] Backup/restore guide includes Restauracion
[ OK ] Backup/restore guide includes qa\FINAL_RESTORE_PROOF.md
[ OK ] Backup/restore guide includes validate_restore_mysql.sh
[ OK ] Backup/restore guide includes HOSPITAL_VALIDATE_RESTORE_MYSQL=1
[ OK ] Restore guide requires disposable/safe restore target
[ OK ] Restore guide forbids restoring over production for testing
[ OK ] Restore guide requires verifiable restore evidence fields
[ OK ] Restore guide explains no normal UI restore
[ OK ] Backup worker smoke avoids credentials in URL
[ OK ] Backup/support docs include safety term: No borre
[ OK ] Backup/support docs include safety term: No restaure
[ OK ] Backup/support docs include safety term: No ejecute seeders
[ OK ] Backup/support docs include safety term: no restaura backups automaticamente
[ OK ] Backup/support docs include safety term: paquete de soporte
[ OK ] Backup/support docs include safety term: No agregue archivos .env
[ OK ] Backup/restore docs do not expose secret-like assignments

BACKUP_RESTORE_DOCS_SAFETY: YES
```

## Backup startup current-user safety validation output

```text
[ OK ] Found scripts\install_backup_startup_current_user.ps1
[ OK ] Found scripts\start_backup_automation.cmd
[ OK ] Found scripts\run_backup_scheduler_loop.ps1
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md
[ OK ] Found qa\OPERATIONAL_SUPPORT_EVIDENCE_2026-05-31.md
[ OK ] Installer exposes WhatIfOnly
[ OK ] Installer exposes Status
[ OK ] Installer exposes Uninstall
[ OK ] Installer exposes StartNow
[ OK ] Installer uses current-user HKCU Run
[ OK ] Installer uses current-user Startup folder
[ OK ] Installer sanitizes operator output
[ OK ] Installer dry run states no writes/process start
[ OK ] Installer trap warns against destructive recovery
[ OK ] Installer uninstall only removes Startup file
[ OK ] Installer uninstall only removes HKCU Run value
[ OK ] Installer does not write machine-wide Run keys
[ OK ] Installer does not recursively delete files
[ OK ] Installer avoids destructive database/container operations
[ OK ] Launcher supports check-only mode
[ OK ] Launcher uses NoProfile PowerShell
[ OK ] Launcher starts background worker hidden
[ OK ] Launcher has human failure message
[ OK ] Launcher does not contain secret names
[ OK ] Scheduler loop exposes WhatIfOnly
[ OK ] Scheduler WhatIf states no worker, backup or writes
[ OK ] Scheduler uses single-instance mutex
[ OK ] Scheduler sanitizes log/output text
[ OK ] Scheduler avoids destructive database/container operations
[ OK ] Docs mention current-user backup startup installer
[ OK ] Docs explain current-user dry run safety
[ OK ] Docs mention Startup/HKCU fallback
[ OK ] Docs keep backup startup safety warnings
Validacion de arranque de backups completada.
Modo WhatIf: no se crea archivo de inicio, no se cambia el registro y no se inicia el worker.
Hora diaria validada: 23:30
PHP: archivo configurado
[ OK ] Current-user backup startup dry run completed with expected safety behavior
DailyBackupTime debe usar formato HH:mm de 24 horas, por ejemplo 02:00 o 23:30.
No borre respaldos, archivos .env, volumenes Docker ni carpetas de datos para corregir la automatizacion.
[ OK ] Current-user backup startup invalid time completed with expected safety behavior
Automatizacion en carpeta Startup: no instalada para el usuario actual.
Automatizacion HKCU Run: no instalada para el usuario actual.
[ OK ] Current-user backup startup status completed with expected safety behavior

BACKUP_STARTUP_CURRENT_USER_SAFETY: YES
```

## Windows restore safety validation output

```text
[ OK ] Found scripts\restore_hospital_windows.ps1
[ OK ] Found docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md
[ OK ] Found docs\BACKUP_RESTORE.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Restore helper exposes non-destructive -SelfTest
[ OK ] Restore helper implements self-test function
[ OK ] Restore helper has disposable database name guard
[ OK ] Restore helper rejects production-like database names
[ OK ] Restore helper requires disposable target wording
[ OK ] Restore helper reads interactive password as SecureString
[ OK ] Restore helper clears SecureString BSTR after conversion
[ OK ] Restore helper validates connection config before restore
[ OK ] Restore helper only allows .sql or .tar.gz backup files
[ OK ] Restore self-test explicitly avoids DB and backup mutation
[ETAPA] Ejecutando self-test de restore seguro
[OK] Self-test completado. No se tocaron bases ni backups.
[ OK ] Restore helper self-test passes without touching databases or backups
[ OK ] Docs require restore helper self-test
[ OK ] Docs require disposable restore target
[ OK ] Docs warn against restoring over production
[ OK ] Docs preserve final restore proof path

RESTORE_WINDOWS_SAFETY: YES
```

## Installation docs safety validation output

```text
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md
[ OK ] Found docs\OFFLINE_LAN_INSTALL.md
[ OK ] Found docs\BACKUP_RESTORE.md
[ OK ] Found docs\DAILY_CLOSE_PROTOCOL.md
[ OK ] Found docs\DISASTER_RECOVERY.md
[ OK ] Found docs\TRAINING_ADMIN.md
[ OK ] Found docs\Manual_Usuario.md
[ OK ] Found docs\manuales\INDICE_OPERADOR.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Installation guide includes section: Antes De Instalar
[ OK ] Installation guide includes section: Instalar
[ OK ] Installation guide includes section: Abrir El Sistema
[ OK ] Installation guide includes section: Arranque Automatico
[ OK ] Installation guide includes section: Respaldos Automaticos
[ OK ] Installation guide includes section: Validacion Inicial
[ OK ] Installation guide includes section: Cierre Final Antes De Operar
[ OK ] Installation guide includes section: Soporte
[ OK ] Installation guide includes section: Paquete Seguro Para Soporte
[ OK ] Installation guide includes safety text: No borre carpetas de datos ni volumenes de base de datos
[ OK ] Installation guide includes safety text: no debe ofrecer una opcion de "instalacion limpia"
[ OK ] Installation guide includes safety text: migrate:fresh
[ OK ] Installation guide includes safety text: sin correr seeders de demostracion
[ OK ] Installation guide includes safety text: APP_VERSION
[ OK ] Installation guide includes safety text: https://IP-DEL-SERVIDOR
[ OK ] Installation guide includes safety text: APP_URL
[ OK ] Installation guide includes safety text: install_hospital_startup_shortcut.ps1
[ OK ] Installation guide includes safety text: install_stack_autostart_windows.ps1
[ OK ] Installation guide includes safety text: SistemaCajaHospitalaria-StackAutostart
[ OK ] Installation guide includes safety text: AtStartup
[ OK ] Installation guide includes safety text: -WhatIfOnly
[ OK ] Installation guide includes safety text: install_backup_tasks_windows.ps1
[ OK ] Installation guide includes safety text: install_backup_startup_current_user.ps1
[ OK ] Installation guide includes safety text: BackupWorker
[ OK ] Installation guide includes safety text: DailyBackup
[ OK ] Installation guide includes safety text: Pendiente
[ OK ] Installation guide includes safety text: Protegido
[ OK ] Installation guide includes safety text: LAN_CLIENT_VALIDATION_PROOF.md
[ OK ] Installation guide includes safety text: INSTITUTIONAL_RECEIPT_PRINT_PROOF.md
[ OK ] Installation guide includes safety text: FINAL_STARTUP_TASK_PROOF.md
[ OK ] Installation guide includes safety text: FINAL_BACKUP_TASK_PROOF.md
[ OK ] Installation guide includes safety text: FINAL_RESTORE_PROOF.md
[ OK ] Installation guide includes safety text: FINAL_CONCURRENCY_PROOF.md
[ OK ] Installation guide includes safety text: final_production_handoff.ps1
[ OK ] Installation guide includes safety text: -InitializeProofFiles
[ OK ] Installation guide includes safety text: PRODUCTION_CANDIDATE
[ OK ] Installation guide includes safety text: validate_lan_client.ps1
[ OK ] Installation guide includes safety text: repair_hospital_system.ps1
[ OK ] Installation guide includes safety text: LOCAL_REPAIR_DIAGNOSTIC.md
[ OK ] Installation guide includes safety text: collect_support_packet.ps1
[ OK ] Installation guide includes safety text: support-packets
[ OK ] Installation guide forbids credentials in URLs
[ OK ] Installation guide keeps handoff reports inside qa
[ OK ] Installation guide keeps LAN evidence inside qa
[ OK ] Installation guide documents non-mutating dry runs
[ OK ] Installation guide documents safe repair limits
[ OK ] Installation guide protects .env files
[ OK ] Installation guide uses -NoProfile in documented PowerShell commands
[ OK ] First-level support guide uses -NoProfile in documented PowerShell commands
[ OK ] Backup and restore guide uses -NoProfile in documented PowerShell commands
[ OK ] Offline LAN install guide uses -NoProfile in documented PowerShell commands
[ OK ] Release checklist uses -NoProfile in documented PowerShell commands
[ OK ] Backup/restore reference uses -NoProfile in documented PowerShell commands
[ OK ] Daily close protocol uses -NoProfile in documented PowerShell commands
[ OK ] Disaster recovery guide uses -NoProfile in documented PowerShell commands
[ OK ] Admin training guide uses -NoProfile in documented PowerShell commands
[ OK ] General user manual uses -NoProfile in documented PowerShell commands
[ OK ] Operator index uses -NoProfile in documented PowerShell commands
[ OK ] Install/release docs include guardrail: PRODUCTION_READY
[ OK ] Install/release docs include guardrail: PRODUCTION_CANDIDATE
[ OK ] Install/release docs include guardrail: No ejecutar `migrate:fresh` en el servidor real
[ OK ] Install/release docs include guardrail: no restaura backups automaticamente
[ OK ] Install/release docs include guardrail: no reemplaza un archivo existente por accidente
[ OK ] Install/release docs include guardrail: no sobrescribe
[ OK ] Install/release docs include guardrail: No declare la instalacion lista para produccion
[ OK ] Install/release docs include guardrail: segunda computadora
[ OK ] Install/release docs include guardrail: impresora institucional
[ OK ] Install/release docs include guardrail: base descartable
[ OK ] Install/release docs include guardrail: concurrencia
[ OK ] Install/release docs include guardrail: make_offline_release.ps1 -SelfTest
[ OK ] Install/release docs include guardrail: validate_dependency_manifest.ps1
[ OK ] Install/release docs include guardrail: package_manifest.json
[ OK ] Installation/support docs do not expose secret-like assignments

INSTALLATION_DOCS_SAFETY: YES
```

## Help screen safety validation output

```text
[ OK ] Found frontend\src\features\help\HelpView.tsx
[ OK ] Found frontend\src\features\help\HelpView.test.tsx
[ OK ] Found frontend\src\lib\support\clientIssueLog.ts
[ OK ] Found frontend\src\lib\support\clientIssueLog.test.ts
[ OK ] Help screen includes required section/text: Ayuda institucional
[ OK ] Help screen includes required section/text: Abrir el sistema
[ OK ] Help screen includes required section/text: Iniciar sesion
[ OK ] Help screen includes required section/text: Abrir caja
[ OK ] Help screen includes required section/text: Nueva factura
[ OK ] Help screen includes required section/text: Cobrar
[ OK ] Help screen includes required section/text: Imprimir recibo
[ OK ] Help screen includes required section/text: Reimprimir
[ OK ] Help screen includes required section/text: Reportes
[ OK ] Help screen includes required section/text: Respaldos
[ OK ] Help screen includes required section/text: Cierre de turno
[ OK ] Help screen includes required section/text: Pedir soporte
[ OK ] Help screen includes required section/text: Evidencia local para soporte
[ OK ] Help screen includes required section/text: Preparar resumen
[ OK ] Help screen includes required section/text: Ver evidencia
[ OK ] Help screen includes required section/text: Atajos de teclado
[ OK ] Help screen includes required section/text: Responsabilidades por rol
[ OK ] Help screen includes required section/text: Checklist diario por rol
[ OK ] Help screen includes required section/text: Acciones delicadas
[ OK ] Help screen includes required section/text: Capacitaci
[ OK ] Help screen includes incident guidance: Servidor no disponible
[ OK ] Help screen includes incident guidance: Impresora no responde
[ OK ] Help screen includes incident guidance: Falla la red
[ OK ] Help screen includes incident guidance: Se fue la luz
[ OK ] Help screen includes incident guidance: Caja qued
[ OK ] Help screen includes incident guidance: Diferencia de caja
[ OK ] Help screen includes incident guidance: Respaldo fallido
[ OK ] Help screen includes incident guidance: Base de datos necesita restaurarse
[ OK ] Help screen includes incident guidance: Sin permiso
[ OK ] Help screen includes incident guidance: Se cerro el navegador
[ OK ] Help screen warns not to duplicate invoices/payments
[ OK ] Help screen tells staff to check cashbox/history before retrying
[ OK ] Help screen keeps safe practice/restore database warning
[ OK ] Help support evidence explains secrets are not included
[ OK ] Help screen prepares safe support summary
[ OK ] Help screen reads local client issue evidence
[ OK ] Help screen can copy support summary when browser allows it
[ OK ] Client issue log includes safety behavior: safeClientMessage
[ OK ] Client issue log includes safety behavior: hospital_client_issue_log
[ OK ] Client issue log includes safety behavior: MAX_ISSUES = 20
[ OK ] Client issue log includes safety behavior: PERMISSION_DENIED_MESSAGE
[ OK ] Client issue log includes safety behavior: buildClientIssueSupportSummary
[ OK ] Client issue log includes safety behavior: Resumen seguro para soporte
[ OK ] Client issue log includes safety behavior: Acci
[ OK ] Client issue log includes safety behavior: no repetir facturas ni cobros
[ OK ] Client issue log includes safety behavior: [redacted]
[ OK ] Client issue log includes safety behavior: [archivo-protegido]
[ OK ] Client issue log includes safety behavior: [campo-interno]
[ OK ] Client issue log includes safety behavior: [detalle-tecnico]
[ OK ] Client issue log includes safety behavior: [ruta-local]
[ OK ] Client issue log redacts technical pattern: DB_PASSWORD
[ OK ] Client issue log redacts technical pattern: APP_KEY
[ OK ] Client issue log redacts technical pattern: SQLSTATE
[ OK ] Client issue log redacts technical pattern: \.env
[ OK ] Client issue log redacts technical pattern: storage[\\/]+logs
[ OK ] Client issue log redacts technical pattern: https?:\/\/
[ OK ] Help/support tests cover: shows operational support guidance
[ OK ] Help/support tests cover: servidor no disponible
[ OK ] Help/support tests cover: impresora no responde
[ OK ] Help/support tests cover: se fue la luz
[ OK ] Help/support tests cover: caja qued
[ OK ] Help/support tests cover: base de datos necesita restaurarse
[ OK ] Help/support tests cover: se cerro el navegador
[ OK ] Help/support tests cover: evidencia local para soporte
[ OK ] Help/support tests cover: preparar resumen
[ OK ] Help/support tests cover: redacts sensitive words
[ OK ] Help/support tests cover: removes URL credentials
[ OK ] Help/support tests cover: without secrets or local paths
[ OK ] Help screen does not expose secret-like assignments

HELP_SCREEN_SAFETY: YES
```

## System diagnostics safety validation output

```text
[ OK ] Found frontend\src\features\about\AboutView.tsx
[ OK ] Found frontend\src\features\about\AboutView.test.tsx
[ OK ] Found frontend\src\hooks\useServerStatus.ts
[ OK ] Found frontend\src\hooks\useServerStatus.test.tsx
[ OK ] Found frontend\src\lib\api\types.ts
[ OK ] Found backend\app\Http\Controllers\SystemStatusController.php
[ OK ] Found backend\tests\Feature\SystemStatusTest.php
[ OK ] Found backend\routes\api.php
[ OK ] About diagnostics include required text: Informacion del sistema
[ OK ] About diagnostics include required text: Resumen operativo
[ OK ] About diagnostics include required text: Todo bien
[ OK ] About diagnostics include required text: Error
[ OK ] About diagnostics include required text: Diagnostico administrativo
[ OK ] About diagnostics include required text: Pulso operativo administrativo
[ OK ] About diagnostics include required text: Lectura para soporte
[ OK ] About diagnostics include required text: BarChart
[ OK ] About diagnostics include required text: useElementWidth
[ OK ] About diagnostics include required text: scheduler_heartbeat
[ OK ] About diagnostics include required text: sin claves ni rutas internas
[ OK ] About diagnostics include required text: Backend
[ OK ] About diagnostics include required text: Base de datos
[ OK ] About diagnostics include required text: Interfaz web
[ OK ] About diagnostics include required text: Ultimo respaldo
[ OK ] About diagnostics include required text: Cola de trabajos
[ OK ] About diagnostics include required text: Cola LAN
[ OK ] About diagnostics include required text: Retardo DB
[ OK ] About diagnostics include required text: Respuesta DB
[ OK ] About diagnostics include required text: Conexiones DB
[ OK ] About diagnostics include required text: Actividad
[ OK ] About diagnostics include required text: Sin cola acumulada
[ OK ] About diagnostics include required text: Base local sin replica
[ OK ] About diagnostics include required text: Version instalada
[ OK ] About diagnostics include required text: Red local
[ OK ] About diagnostics include required text: Migraciones
[ OK ] About diagnostics include required text: Hora del servidor
[ OK ] About diagnostics include required text: Espacio libre para respaldos
[ OK ] About diagnostics include required text: Acceso LAN
[ OK ] About diagnostics include required text: system.status.view
[ OK ] About diagnostics gate advanced details by permission
[ OK ] About diagnostics centralize admin status labels
[ OK ] About diagnostics centralize admin health dashboard metrics
[ OK ] About diagnostics consume operational health metrics
[ OK ] About diagnostics translate database lag safely
[ OK ] About diagnostics translate database latency safely
[ OK ] About diagnostics translate database connections safely
[ OK ] About diagnostics translate backend uptime safely
[ OK ] About diagnostics translate scheduler heartbeat for support
[ OK ] About diagnostics render status levels consistently
[ OK ] About diagnostics format disk space for operators
[ OK ] Server status hook includes safe summary behavior: /api/system/health
[ OK ] Server status hook includes safe summary behavior: Todo bien
[ OK ] Server status hook includes safe summary behavior: Requiere revision
[ OK ] Server status hook includes safe summary behavior: Error
[ OK ] Server status hook includes safe summary behavior: No se pudo confirmar el servidor local
[ OK ] Server status hook includes safe summary behavior: La base de datos local no responde
[ OK ] Server status hook includes safe summary behavior: Detenga la facturacion
[ OK ] Server status hook includes safe summary behavior: Hay trabajos o respaldos con alerta
[ OK ] Server status hook includes safe summary behavior: revise respaldos
[ OK ] Server status hook includes safe summary behavior: worker_recently_active
[ OK ] Server status hook includes safe summary behavior: success_last_24h
[ OK ] Server status hook includes safe summary behavior: failed_last_24h
[ OK ] Server status hook includes safe summary behavior: storage
[ OK ] Operational health type includes extended safe field: database_lag
[ OK ] Operational health type includes extended safe field: database_perf
[ OK ] Operational health type includes extended safe field: queue_size
[ OK ] Operational health type includes extended safe field: disk_free_gb
[ OK ] Operational health type includes extended safe field: app_uptime_s
[ OK ] Backend system status includes safe field: environmentStatus
[ OK ] Backend system status includes safe field: databaseStatus
[ OK ] Backend system status includes safe field: frontendStatus
[ OK ] Backend system status includes safe field: networkStatus
[ OK ] Backend system status includes safe field: backupStatus
[ OK ] Backend system status includes safe field: runtimeStatus
[ OK ] Backend system status includes safe field: readinessStatus
[ OK ] Backend system status includes safe field: preflightStatus
[ OK ] Backend system status includes safe field: app_version
[ OK ] Backend system status includes safe field: server_time
[ OK ] Backend system status includes safe field: timezone
[ OK ] Backend system status includes safe field: lan_ready
[ OK ] Backend system status includes safe field: client_url
[ OK ] Backend system status includes safe field: last_success_at
[ OK ] Backend system status includes safe field: pending_backup_jobs
[ OK ] Backend system status includes safe field: failed_jobs_count
[ OK ] Backend system status includes safe field: free_bytes
[ OK ] Backend system status includes safe field: pending_migration_count
[ OK ] Backend system status includes safe field: PRODUCTION_CANDIDATE
[ OK ] Backend system status includes safe field: OperationalMessageSanitizer::url
[ OK ] Backend system status includes safe field: OperationalMessageSanitizer::message
[ OK ] Backend system status route is registered
[ OK ] Backend public health route is registered
[ OK ] Diagnostics tests cover: non-technical language
[ OK ] Diagnostics tests cover: without exposing raw technical details
[ OK ] Diagnostics tests cover: protected administrative diagnostics
[ OK ] Diagnostics tests cover: system status permission
[ OK ] Diagnostics tests cover: reads the public operational health endpoint
[ OK ] Diagnostics tests cover: cashier-safe language
[ OK ] Diagnostics tests cover: database failures
[ OK ] Diagnostics tests cover: without secret values
[ OK ] Diagnostics tests cover: sanitized scheduler heartbeat messages
[ OK ] Diagnostics tests cover: admin operational pulse without raw commands or paths
[ OK ] Diagnostics tests cover: extended admin health metrics safely
[ OK ] Diagnostics tests cover: system.status.view
[ OK ] About diagnostics UI does not expose forbidden technical details
[ OK ] System status controller does not expose secret-like assignments

SYSTEM_DIAGNOSTICS_SAFETY: YES
```

## Double-action safety validation output

```text
[ OK ] Found scripts\validate_mysql_concurrency.mjs
[ OK ] Found qa\FINAL_CONCURRENCY_PROOF.md
[ OK ] Found backend\tests\Feature\InvoiceCreationTest.php
[ OK ] Found backend\tests\Feature\CashPaymentsReceiptTest.php
[ OK ] Found backend\app\Actions\Billing\CreateInvoiceAction.php
[ OK ] Found backend\app\Actions\Cash\OpenCashSessionAction.php
[ OK ] Found backend\app\Actions\Payments\RegisterPaymentAction.php
[ OK ] Found frontend\src\lib\api\base.ts
[ OK ] Found frontend\src\lib\api\base.test.ts
[ OK ] Found frontend\src\features\help\HelpView.tsx
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Concurrency validator requires explicit real-MySQL opt-in
[ OK ] Concurrency validator confirms target URL separately
[ OK ] Concurrency validator requires target environment
[ OK ] Concurrency validator rejects credentials in URLs
[ OK ] Concurrency validator refuses production-like targets
[ OK ] Concurrency validator requires disposable/local target wording
[ OK ] Concurrency evidence path is constrained
[ OK ] Concurrency evidence stays under qa
[ OK ] Concurrency validator exercises double cash opening
[ OK ] Concurrency validator exercises concurrent invoice emission
[ OK ] Concurrency validator exercises double payment
[ OK ] Concurrency validator accepts created status and conflict/validation statuses
[ OK ] Concurrency validator documents audit limitation for disposable snapshots
[ OK ] Final concurrency proof records double cash opening result
[ OK ] Final concurrency proof records concurrent invoice result
[ OK ] Final concurrency proof records double payment result
[ OK ] Final concurrency proof records duplicate-action status split
[ OK ] Final concurrency proof has a final conclusion
[ OK ] Invoice feature test covers concurrent invoice number uniqueness
[ OK ] Invoice feature test rejects duplicate invoice numbers
[ OK ] Invoice feature test checks distinct invoice numbers
[ OK ] Invoice creation uses a database transaction
[ OK ] Invoice creation locks open cash session while issuing
[ OK ] Invoice creation uses fiscal number action inside transaction
[ OK ] Cash open action checks for already-open session
[ OK ] Cash open action locks existing session check
[ OK ] Cash open action returns operator-safe duplicate cashbox message
[ OK ] Cash tests cover duplicate open request
[ OK ] Cash tests cover database uniqueness guard
[ OK ] Cash tests expect duplicate open validation
[ OK ] Payment registration locks the invoice
[ OK ] Payment registration locks the cash session
[ OK ] Payment registration rejects already paid invoices
[ OK ] Payment registration rejects overpayment
[ OK ] Payment tests reject paid invoices and overpayment
[ OK ] API maps duplicate billing operations to history guidance
[ OK ] API maps cashbox conflicts to cashbox/history guidance
[ OK ] API tests protect duplicate-operation guidance
[ OK ] API tests avoid exposing raw internal conflict fields
[ OK ] Help warns staff not to repeat invoices or payments
[ OK ] Help tells staff to check cashbox/history before retrying
[ OK ] Cashier manual warns before repeating invoice or payment
[ OK ] Supervisor manual warns before repeating invoice or payment
[ OK ] Administrator manual requires history/audit review before retrying

DOUBLE_ACTION_SAFETY: YES
```

## Realtime own-event safety validation output

```text
[ OK ] Found frontend\src\lib\realtime\useBroadcastSync.ts
[ OK ] Found frontend\src\lib\realtime\useBroadcastSync.test.ts
[ OK ] Found frontend\src\lib\realtime\session.ts
[ OK ] Found frontend\src\lib\realtime\types.ts
[ OK ] Found frontend\src\layout\AppShell.tsx
[ OK ] Found backend\tests\Feature\BroadcastingWiringTest.php
[ OK ] Found docs\manuales\RUNBOOK_INCIDENTES_COMUNES.md
[ OK ] Found qa\REALTIME_OWN_EVENT_SAFETY_2026_06_04.md
[ OK ] Found backend\app\Events\InvoiceChanged.php
[ OK ] InvoiceChanged accepts optional actor id
[ OK ] InvoiceChanged broadcasts actor_id
[ OK ] InvoiceChanged keeps expected channel invoices
[ OK ] InvoiceChanged keeps expected event name invoice.changed
[ OK ] Found backend\app\Events\PaymentChanged.php
[ OK ] PaymentChanged accepts optional actor id
[ OK ] PaymentChanged broadcasts actor_id
[ OK ] PaymentChanged keeps expected channel payments
[ OK ] PaymentChanged keeps expected event name payment.changed
[ OK ] Found backend\app\Events\CashSessionChanged.php
[ OK ] CashSessionChanged accepts optional actor id
[ OK ] CashSessionChanged broadcasts actor_id
[ OK ] CashSessionChanged keeps expected channel cash
[ OK ] CashSessionChanged keeps expected event name cash-session.changed
[ OK ] Backend test asserts invoice actor_id
[ OK ] Backend test asserts payment actor_id
[ OK ] Backend test asserts cash actor_id
[ OK ] Backend test proves invoice creation carries actor id
[ OK ] Session cache starts without user
[ OK ] Session cache supports login/logout updates
[ OK ] Session cache exposes current user id
[ OK ] Frontend realtime event types keep optional actor_id for invoice, payment and cash
[ OK ] useBroadcastSync reads current user at event time
[ OK ] useBroadcastSync has own-event comparison helper
[ OK ] Own-event helper compares actor id with current user id
[ OK ] useBroadcastSync has notification decision helper
[ OK ] Notification helper reads stored user dynamically
[ OK ] Invoice handler invalidates before suppressing own toast
[ OK ] Payment handler invalidates before suppressing own toast
[ OK ] Cash handler invalidates before suppressing own toast
[ OK ] Frontend test covers dynamic current-user changes
[ OK ] Frontend test keeps legacy events visible
[ OK ] Frontend test suppresses own actor id
[ OK ] Frontend test notifies when actor id missing
[ OK ] AppShell imports broadcast sync
[ OK ] AppShell mounts broadcast sync once
[ OK ] Docs/evidence mention actor_id
[ OK ] Docs/evidence explain own-event suppression
[ OK ] Docs/evidence keep final LAN proof separate
[ OK ] Realtime own-event evidence does not expose APP_KEY
[ OK ] Realtime own-event evidence does not expose DB_PASSWORD
[ OK ] Realtime own-event evidence does not expose secret-like values

REALTIME_OWN_EVENT_SAFETY: YES
```

## Installer legacy safety validation output

```text
[ OK ] Found scripts\release_setup.bat
[ OK ] Found scripts\deploy_hospital_lan.ps1
[ OK ] Found scripts\install_hospital_os.ps1
[ OK ] Found scripts\make_offline_release.ps1
[ OK ] Found scripts\assert_offline_release_clean.ps1
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\OFFLINE_LAN_INSTALL.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Found docs\OPERATIVE_NOTES_2026_06_02.md
[ OK ] setup.bat launcher delegates to supported LAN installer
[ OK ] setup.bat launcher does not invoke legacy installer
[ OK ] setup.bat launcher runs from its own folder
[ OK ] setup.bat launcher disables PowerShell profiles
[ OK ] setup.bat launcher gives administrator recovery instructions
[ OK ] setup.bat launcher uses institutional wording
[ OK ] setup.bat launcher does not use legacy branding
[ OK ] setup.bat launcher does not describe the install as demo
[ OK ] offline release builder uses release_setup.bat as root setup.bat
[ OK ] offline release guard requires supported LAN installer
[ OK ] offline release guard checks supported LAN installer source hash
[ OK ] offline release guard checks root setup launcher source hash
[ OK ] offline release guard checks setup launcher working directory
[ OK ] offline release guard checks setup launcher NoProfile
[ OK ] offline release guard rejects legacy setup launcher
[ OK ] supported installer uses institutional name
[ OK ] supported installer has diagnostics-only mode
[ OK ] supported installer has self-test mode
[ OK ] supported installer refuses missing backup task installer
[ OK ] supported installer runs safe migrations
[ OK ] supported installer does not run migrate:fresh
[ OK ] supported installer creates explicit role/catalog seeders only
[ OK ] legacy installer is marked deprecated at top of file
[ OK ] legacy installer points operators to supported installer
[ OK ] legacy installer explains backwards compatibility only
[ OK ] legacy installer warns at runtime
[ OK ] legacy installer says no new code paths should reference it
[ OK ] operator install guide uses setup.bat for normal install
[ OK ] operator install guide identifies supported LAN installer
[ OK ] operator install guide limits legacy installer to compatibility
[ OK ] operator install guide forbids clean destructive install
[ OK ] operator install guide forbids demo seeders
[ OK ] offline install guide prefers supported installer
[ OK ] operative notes record legacy installer deprecation
[ OK ] release checklist mentions installer legacy guard
[ OK ] Active docs/scripts do not point operators to legacy installer

INSTALLER_LEGACY_SAFETY: YES
```

## LAN recovery safety validation output

```text
[ OK ] Found scripts\refresh_lan_ip.ps1
[ OK ] Found scripts\lib\net_diagnostics.ps1
[ OK ] Found scripts\lib\env_helpers.ps1
[ OK ] Found scripts\lib\cors_helpers.ps1
[ OK ] Found scripts\validate_lan_client.ps1
[ OK ] Found scripts\test_validate_lan_client_safety.ps1
[ OK ] Found scripts\repair_hospital_system.ps1
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] LAN refresh script supports PowerShell WhatIf
[ OK ] LAN refresh uses native WhatIf without a duplicate custom parameter
[ OK ] LAN refresh script imports env helper library
[ OK ] LAN refresh script imports network diagnostics library
[ OK ] LAN refresh script imports CORS helper library
[ OK ] LAN refresh script does not reference removed helper files
[ OK ] LAN refresh script reads existing env safely
[ OK ] LAN refresh script writes env through ASCII-safe helper
[ OK ] LAN refresh updates SERVER_IP
[ OK ] LAN refresh updates APP_URL
[ OK ] LAN refresh updates APP_HTTPS_PORT
[ OK ] LAN refresh updates Sanctum stateful domains
[ OK ] LAN refresh updates CORS allowed origins
[ OK ] LAN refresh writes HTTPS APP_URL
[ OK ] LAN refresh updates Windows firewall rule
[ OK ] LAN refresh restarts affected services
[ OK ] LAN refresh guards client IP notice with ShouldProcess
[ OK ] LAN refresh does not run destructive database commands
[ OK ] Network diagnostics use default route metrics
[ OK ] Network diagnostics identify DHCP addresses
[ OK ] Network diagnostics warn about localhost for clients
[ OK ] Network diagnostics warn about APIPA addresses
[ OK ] Env helper writes ASCII env files
[ OK ] CORS helper defaults LAN URL to HTTPS
[ OK ] CORS helper production origins do not allow HTTP LAN
[ OK ] LAN validation rejects credentials in URLs
[ OK ] LAN validation keeps evidence under qa
[ OK ] LAN validation supports WhatIfOnly
[ OK ] LAN validation safety test covers WhatIf no-write
[ OK ] LAN validation safety test rejects credential URLs
[ OK ] Repair diagnostics warn about localhost APP_URL
[ OK ] Support guide documents IP refresh preview
[ OK ] Support guide tells staff not to invoice while LAN is down
[ OK ] Install guide documents IP refresh preview
[ OK ] Install guide requires second-client validation after refresh
[ OK ] Supervisor manual warns clients not to use localhost
[ OK ] Release checklist mentions LAN recovery guard
[ OK ] LAN refresh WhatIf exits successfully against disposable fixture
[ OK ] LAN refresh WhatIf does not modify env files
[ OK ] LAN refresh WhatIf does not write client IP notice

LAN_RECOVERY_SAFETY: YES
```

## LAN loadtest safety validation output

```text
LAN_LOADTEST_SAFETY: YES
LAN emulation and loadtest runners require disposable/validation targets and explicit credentials.
```

## Known limitations safety validation output

```text
[ OK ] Found docs\KNOWN_LIMITATIONS.md
[ OK ] Found qa\INSTALLER_LEGACY_SAFETY_2026_06_03.md
[ OK ] Found qa\LAN_RECOVERY_SAFETY_2026_06_03.md
[ OK ] Found scripts\lib\net_diagnostics.ps1
[ OK ] Found qa\FINAL_PRODUCTION_HANDOFF_RESULT.md
[ OK ] Found backend\tests\Feature\CspReportControllerTest.php
[ OK ] Found backend\app\Http\Controllers\CspReportController.php
[ OK ] Found .github\workflows\ci.yml
[ OK ] Found backend\tests\Coverage\CriticalModulesCoverageTest.php
[ OK ] Found scripts\validate_new_invoice_maintainability.ps1
[ OK ] Found frontend\src\features\invoices\NewInvoiceView.tsx
[ OK ] Known limitations no longer lists legacy installer deprecation as pending
[ OK ] Known limitations no longer lists robust IP detection as pending
[ OK ] Known limitations no longer lists barcode/report SQL relocation as pending
[ OK ] Known limitations no longer lists CSP report channel as pending
[ OK ] Known limitations no longer lists maintenance command as pending
[ OK ] Known limitations no longer lists permission audit as pending
[ OK ] Known limitations no longer lists per-user rate limit as pending
[ OK ] Known limitations no longer lists critical coverage gate as pending
[ OK ] Known limitations no longer lists NewInvoiceView refactor as pending
[ OK ] Known limitations records closed item: Installer legacy compatibility guarded
[ OK ] Known limitations records closed item: LAN/IP recovery guarded
[ OK ] Known limitations records closed item: Barcode/report SQL reference isolated
[ OK ] Known limitations records closed item: CSP report channel implemented
[ OK ] Known limitations records closed item: Maintenance mode guarded
[ OK ] Known limitations records closed item: Permission audit guarded
[ OK ] Known limitations records closed item: Per-user rate limit guarded
[ OK ] Known limitations records closed item: Cobertura >80% en modulos criticos
[ OK ] Known limitations records closed item: NewInvoiceView refactor
[ OK ] Known limitations preserves final blocker: LAN client validation
[ OK ] Known limitations preserves final blocker: Impresora fisica
[ OK ] Known limitations preserves final blocker: Restore real final
[ OK ] Known limitations preserves final blocker: Concurrencia final
[ OK ] Known limitations preserves final blocker: Worker continuo de backups
[ OK ] Known limitations preserves final blocker: SistemaCajaHospitalaria-StackAutostart
[ OK ] Known limitations preserves final blocker: Handoff final
[ OK ] Installer legacy evidence passes
[ OK ] LAN recovery evidence passes
[ OK ] LAN evidence covers route metric based IP selection
[ OK ] Network diagnostics use Get-NetRoute
[ OK ] Network diagnostics sort LAN candidates by route metric
[ OK ] Handoff stays production candidate
[ OK ] Handoff preserves stack autostart final-server blocker
[ OK ] Barcode/report SQL reference is isolated under database\_reference_DO_NOT_EXECUTE
[ OK ] No executable barcode/report SQL extension remains at database root
[ OK ] CSP report route is covered by feature test
[ OK ] CSP report route keeps rate limit test
[ OK ] CSP report controller records reports for support
[ OK ] CI installs a coverage driver for backend jobs
[ OK ] CI requires the critical coverage gate
[ OK ] CI invokes the coverage phpunit profile
[ OK ] Critical coverage test enforces the 80 percent threshold
[ OK ] Critical coverage test includes module: Billing
[ OK ] Critical coverage test includes module: Cash
[ OK ] Critical coverage test includes module: Payments
[ OK ] Critical coverage test includes module: Backups
[ OK ] Critical coverage test includes module: Receipts
[ OK ] NewInvoice maintainability guard reports a stable result marker
[ OK ] NewInvoice maintainability guard enforces the view size limit
[ OK ] NewInvoice maintainability guard checks invoice lifecycle extraction
[ OK ] NewInvoiceView source is currently under 200 lines (138)
[ OK ] Known limitations does not expose secret-like assignments

KNOWN_LIMITATIONS_SAFETY: YES
```

## Maintenance mode safety validation output

```text
[ OK ] Found backend\app\Console\Commands\MaintenanceCommand.php
[ OK ] Found backend\tests\Feature\MaintenanceModeTest.php
[ OK ] Found backend\bootstrap\app.php
[ OK ] Found backend\resources\views\maintenance.blade.php
[ OK ] Found docs\manuales\INDICE_OPERADOR.md
[ OK ] Found docs\KNOWN_LIMITATIONS.md
[ OK ] Found docs\OPERATIVE_NOTES_2026_06_02.md
[ OK ] Found docs\DECISIONS.md
[ OK ] Maintenance command is registered
[ OK ] Maintenance command requires explicit on/off action
[ OK ] Maintenance command supports operator-facing message
[ OK ] Maintenance command writes Laravel maintenance flag only
[ OK ] Maintenance payload uses 503 status
[ OK ] Maintenance payload keeps short retry guidance
[ OK ] Maintenance payload is structured JSON
[ OK ] Maintenance off removes only the maintenance flag
[ OK ] Maintenance command avoids destructive operations
[ OK ] Maintenance command does not embed secret-like assignments
[ OK ] Maintenance command payload has feature test
[ OK ] HTML maintenance page has feature test
[ OK ] API maintenance JSON has feature test
[ OK ] Maintenance test checks payload omits secrets
[ OK ] Maintenance test hides internal down-file path
[ OK ] Maintenance test rejects mojibake
[ OK ] API maintenance response is human-readable
[ OK ] HTML maintenance response uses institutional view
[ OK ] Maintenance exception handler avoids exposing secrets/raw paths
[ OK ] Maintenance view declares Spanish language
[ OK ] Maintenance view has human heading
[ OK ] Maintenance view tells staff who to contact
[ OK ] Maintenance view avoids technical details
[ OK ] Operator index documents enabling maintenance mode
[ OK ] Operator index documents disabling maintenance mode
[ OK ] Operator index explains maintenance message
[ OK ] Known limitations records maintenance as closed
[ OK ] Known limitations no longer lists maintenance command as pending
[ OK ] Operative notes record maintenance mode status
[ OK ] Decision log records maintenance command decision
[ OK ] Decision log records maintenance safety invariant

MAINTENANCE_MODE_SAFETY: YES
```

## Permission audit safety validation output

```text
[ OK ] Found backend\app\Observers\PermissionAuditObserver.php
[ OK ] Found backend\app\Providers\AppServiceProvider.php
[ OK ] Found backend\config\permission.php
[ OK ] Found backend\tests\Feature\PermissionAuditTest.php
[ OK ] Found backend\app\Http\Controllers\UserController.php
[ OK ] Found docs\KNOWN_LIMITATIONS.md
[ OK ] Found docs\OPERATIVE_NOTES_2026_06_02.md
[ OK ] Found docs\DECISIONS.md
[ OK ] Permission audit observer exists
[ OK ] Observer handles role attach events
[ OK ] Observer handles role detach events
[ OK ] Observer handles permission attach events
[ OK ] Observer handles permission detach events
[ OK ] Observer writes audit_logs records
[ OK ] Observer records human role name
[ OK ] Observer records human permission name
[ OK ] Observer records current operator when available
[ OK ] Observer cannot break business flow
[ OK ] Observer does not downgrade permission audit to logs only
[ OK ] Observer does not embed secret-like assignments
[ OK ] Provider registers permission audit wiring
[ OK ] Provider observes role model changes
[ OK ] Provider observes permission model changes
[ OK ] Provider listens for role attach events
[ OK ] Provider listens for role detach events
[ OK ] Provider listens for permission attach events
[ OK ] Provider listens for permission detach events
[ OK ] Spatie permission events are enabled
[ OK ] Permission exception details stay hidden
[ OK ] Role exception details stay hidden
[ OK ] Role attach audit is covered by feature test
[ OK ] Role sync detach/attach audit is covered by feature test
[ OK ] Role creation audit is covered by feature test
[ OK ] Permission attach audit is covered by feature test
[ OK ] Permission audit action is asserted
[ OK ] Permission audit tests check payload omits sensitive fields
[ OK ] User updates avoid noisy role sync when unchanged
[ OK ] User updates still audit real role changes
[ OK ] Known limitations records permission audit as closed
[ OK ] Known limitations no longer lists permission audit as pending
[ OK ] Operative notes record permission audit status
[ OK ] Operative notes no longer claim permission audit is log-only
[ OK ] Decision log records permission audit decision
[ OK ] Decision log records observer
[ OK ] Decision log records durable audit target

PERMISSION_AUDIT_SAFETY: YES
```

## Rate-limit safety validation output

```text
[ OK ] Found backend\routes\api.php
[ OK ] Found backend\app\Http\Middleware\ThrottleByUser.php
[ OK ] Found backend\bootstrap\app.php
[ OK ] Found backend\tests\Feature\ThrottleByUserTest.php
[ OK ] Found docs\KNOWN_LIMITATIONS.md
[ OK ] Found docs\OPERATIVE_NOTES_2026_06_02.md
[ OK ] Found qa\FINAL_PRODUCTION_HANDOFF_RESULT.md
[ OK ] ThrottleByUser middleware exists
[ OK ] ThrottleByUser keys authenticated users by user id
[ OK ] ThrottleByUser has IP fallback for unauthenticated requests
[ OK ] ThrottleByUser returns human Spanish message
[ OK ] ThrottleByUser returns retry guidance
[ OK ] ThrottleByUser avoids technical/secret details
[ OK ] ThrottleByUser alias is registered
[ OK ] Invoice creation uses per-user throttle
[ OK ] Invoice void uses per-user throttle
[ OK ] Invoice reverse uses per-user throttle
[ OK ] Payment registration uses per-user throttle
[ OK ] Payment void uses per-user throttle
[ OK ] Cashbox open uses per-user throttle
[ OK ] Cashbox close uses per-user throttle
[ OK ] Payment registration no longer uses shared-IP throttle
[ OK ] Payment void no longer uses shared-IP throttle
[ OK ] Throttle safe 429 response is covered
[ OK ] LAN same-IP isolation is covered
[ OK ] Critical write route middleware is covered
[ OK ] Test asserts 60/min per-user buckets
[ OK ] Test asserts 30/min per-user buckets
[ OK ] Known limitations records per-user rate limiting as closed
[ OK ] Known limitations no longer lists per-user rate limit as pending
[ OK ] Operative notes record per-user rate limit status
[ OK ] Handoff records rate-limit evidence
[ OK ] Handoff records rate-limit guard

RATE_LIMIT_SAFETY: YES
```

## Shift incident recovery safety validation output

```text
[ OK ] Found frontend\src\features\help\HelpView.tsx
[ OK ] Found frontend\src\features\help\HelpView.test.tsx
[ OK ] Found frontend\src\lib\support\clientIssueLog.ts
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_CAPACITACION_SEGURA.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Help and tests cover incident: Servidor no disponible
[ OK ] Help and tests cover incident: Impresora no responde
[ OK ] Help and tests cover incident: Falla la red|Red Local Caida|red local caida
[ OK ] Help and tests cover incident: Se fue la luz|reinici
[ OK ] Help and tests cover incident: Caja qued
[ OK ] Help and tests cover incident: Respaldo fallido
[ OK ] Help and tests cover incident: Base de datos necesita restaurarse
[ OK ] Help and tests cover incident: Sesion Vencida|Sesi
[ OK ] Help and tests cover incident: Sin permiso
[ OK ] Help and tests cover incident: Se cerro el navegador|Navegador cerrado
[ OK ] Help tells staff to review cashbox and history after power/browser incidents
[ OK ] Help prevents duplicate printing/payment after printer failure
[ OK ] Help directs database restore to isolated validation first
[ OK ] Help tells staff not to use another account for permissions
[ OK ] Help keeps safe support evidence workflow
[ OK ] Help support summary warns not to repeat invoices or payments
[ OK ] Cashier manual tells staff to prepare safe help summary on errors
[ OK ] Cashier manual forbids retrying uncertain invoices or payments
[ OK ] Cashier manual requires history review before repeating work
[ OK ] Supervisor manual has real-failure section
[ OK ] Supervisor manual covers browser close without duplicate work
[ OK ] Supervisor manual covers open cashbox recovery
[ OK ] Supervisor manual covers backup failure without self-restore
[ OK ] Support guide gathers operational incident facts
[ OK ] Support guide uses safe repair diagnostics
[ OK ] Support guide uses safe support packet without secrets
[ OK ] Support guide forbids destructive first-level actions
[ OK ] Support guide requires closure checks before declaring incident resolved
[ OK ] Training guide drills real incidents before production
[ OK ] Training guide forbids production practice and destructive restore
[ OK ] Administrator manual keeps restore as authorized isolated procedure
[ OK ] Release checklist mentions shift incident recovery guard
[ OK ] Incident recovery docs do not expose secret assignments
[ OK ] Help incident guidance does not expose secret assignments

SHIFT_INCIDENT_RECOVERY_SAFETY: YES
```

## New invoice maintainability validation output

```text
[ OK ] Found frontend\src\features\invoices\NewInvoiceView.tsx
[ OK ] Found frontend\src\features\invoices\components\NewInvoiceViewLayout.tsx
[ OK ] Found frontend\src\features\invoices\state\reducer.ts
[ OK ] Found frontend\src\features\invoices\state\types.ts
[ OK ] Found frontend\src\features\invoices\NewInvoiceView.test.tsx
[ OK ] Found frontend\src\features\invoices\NewInvoiceView.a11y.test.tsx
[ OK ] NewInvoiceView stays under 200 lines (138)
[ OK ] NewInvoiceView keeps extracted dependency: useInvoiceLifecycle
[ OK ] NewInvoiceView keeps extracted dependency: usePaymentLifecycle
[ OK ] NewInvoiceView keeps extracted dependency: usePosCartActions
[ OK ] NewInvoiceView keeps extracted dependency: usePosDataLoader
[ OK ] NewInvoiceView keeps extracted dependency: usePosKeyboardShortcuts
[ OK ] NewInvoiceView keeps extracted dependency: newInvoiceReducer
[ OK ] NewInvoiceView keeps extracted dependency: NewInvoiceViewLayout
[ OK ] NewInvoice layout composes expected UI block: PatientStep
[ OK ] NewInvoice layout composes expected UI block: ServiceSearch
[ OK ] NewInvoice layout composes expected UI block: InvoiceCart
[ OK ] NewInvoice layout composes expected UI block: InvoiceConfirmation
[ OK ] NewInvoice layout composes expected UI block: PaymentModal
[ OK ] NewInvoice layout composes expected UI block: InvoiceSuccess
[ OK ] NewInvoice layout composes expected UI block: ReceiptPreview
[ OK ] Reducer owns reset behavior outside the view
[ OK ] Reducer owns cart add behavior outside the view
[ OK ] Reducer owns dialysis flag behavior outside the view
[ OK ] State contract lives outside the view
[ OK ] Action contract lives outside the view
[ OK ] New invoice tests preserve coverage marker: NewInvoiceView
[ OK ] New invoice tests preserve coverage marker: accessibility
[ OK ] New invoice tests preserve coverage marker: emitir
[ OK ] New invoice tests preserve coverage marker: cobrar
[ OK ] New invoice tests preserve coverage marker: dialysis

NEW_INVOICE_MAINTAINABILITY: YES
```

## Final handoff completeness validation output

```text
[OK] FINAL_HANDOFF_COMPLETENESS: YES
[OK] Handoff evidence includes captures, diagnostics, changed files, gates, physical blockers, risks and safety notes.
```

## Evidence index validation output

```text
[OK] OPS_EVIDENCE_INDEX: YES
[OK] Referencias qa/ verificadas: 49
[OK] El handoff conserva bloqueantes fisicos antes de PRODUCTION_READY.
```

## Preflight output

```text
Preflight skipped by -SkipPreflight.
```
