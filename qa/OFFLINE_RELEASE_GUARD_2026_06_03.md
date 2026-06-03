# Offline release guard evidence - 2026-06-03

Decision: `BLOCKED_UNTIL_REGENERATED`.

Scope:

- Verify that `scripts\assert_offline_release_clean.ps1` rejects the current local `offline-release` package after the browser-smoke-evidence, startup/repair, operator-manual, backup/restore-doc, installation-doc, help-screen, system-diagnostics, double-action, installer-legacy, LAN-recovery, shift-incident-recovery, final-handoff-completeness, operations-objective-audit, field-proof-template and evidence validators were added.
- Confirm that a stale offline package cannot be handed off as production-ready.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1
```

Observed result:

- `OFFLINE_RELEASE_CLEAN: NO`.
- Blocking issue count: 40 in the latest handoff smoke with `-RequireCurrentCommit`; 39 in the direct guard run without commit validation.
- The guard detected missing `scripts\validate_startup_repair_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_browser_smoke_evidence.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_operator_manuals_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_backup_restore_docs_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_installation_docs_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_help_screen_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_system_diagnostics_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_ops_evidence_index.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_training_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_double_action_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_installer_legacy_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_lan_recovery_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_shift_incident_recovery_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_final_handoff_completeness.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_operations_objective_audit.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_field_proof_templates.ps1` in `offline-release`.
- The guard detected missing final-field proof templates under `offline-release\qa\`, including LAN, printer, restore, concurrency and anonymous training acceptance templates.
- The guard detected that `scripts\production_readiness_preflight.ps1` in `offline-release` differs from versioned source.
- The guard detected that `scripts\final_production_handoff.ps1` in `offline-release` differs from versioned source.
- The guard detected that `scripts\make_offline_release.ps1` in `offline-release` differs from versioned source.
- The guard detected multiple release files that differ from versioned source.
- The guard detected that `offline-images` contains no Docker image tar files.

Safety notes:

- This was a read-only guard run.
- No release package was regenerated in this step.
- No `.env`, database volume, backup SQL or production data was deleted or reset.

Required next action before delivery:

- Regenerate `offline-release` from the final commit with real Docker image exports.
- Re-run `scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit`.
- Keep the system as `PRODUCTION_CANDIDATE` until this guard passes together with final LAN, printer, backup worker, restore, concurrency and production preflight evidence.
