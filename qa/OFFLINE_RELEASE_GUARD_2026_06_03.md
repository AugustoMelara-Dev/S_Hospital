# Offline release guard evidence - 2026-06-03

Decision: `BLOCKED_UNTIL_REGENERATED`.

Scope:

- Verify that `scripts\assert_offline_release_clean.ps1` rejects the current local `offline-release` package after the browser-smoke-evidence, startup/repair, stack-autostart, operator-manual, backup/restore-doc, installation-doc, help-screen, system-diagnostics, dependency-manifest, double-action, installer-legacy, LAN-recovery, shift-incident-recovery, final-handoff-completeness, operations-objective-audit, field-proof-template and evidence validators were added.
- Confirm that a stale offline package cannot be handed off as production-ready.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1
```

Observed result:

- `OFFLINE_RELEASE_CLEAN: NO`.
- Blocking issue count: 44 in the latest direct guard run with
  `-RequireCurrentCommit`.
- The guard detected missing `scripts\install_stack_autostart_windows.ps1` in
  `offline-release`.
- The guard detected missing `scripts\validate_startup_repair_safety.ps1` in `offline-release`.
- The guard detected missing `scripts\validate_browser_smoke_evidence.ps1` in `offline-release`.
- The guard detected that `scripts\validate_dependency_manifest.ps1` in `offline-release` differs from versioned source.
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
- The guard detected missing `scripts\validate_proof_initialization_safety.ps1` in `offline-release`.
- The guard detected missing final-field proof templates under `offline-release\qa\`, including LAN, printer, restore, concurrency and anonymous training acceptance templates.
- The guard detected that `scripts\production_readiness_preflight.ps1` in `offline-release` differs from versioned source.
- The guard detected that `scripts\final_production_handoff.ps1` in `offline-release` differs from versioned source.
- The guard detected that `scripts\make_offline_release.ps1` in `offline-release` differs from versioned source.
- The guard detected multiple release files that differ from versioned source.
- The guard detected that root `setup.bat` in `offline-release` differs from
  `scripts\release_setup.bat`, while still checking that the stale launcher
  runs from its own folder, uses `-NoProfile`, delegates to the LAN installer
  and avoids legacy/demo wording.
- The guard detected that `offline-images` contains no Docker image tar files.

Safety notes:

- This was a read-only guard run.
- No release package was regenerated in this step.
- No `.env`, database volume, backup SQL or production data was deleted or reset.

Guard correction added:

- `scripts\assert_offline_release_clean.ps1` now permits only the five required
  final-field proof templates under `qa\*.example.md`.
- The same guard still rejects completed QA evidence, support packets, logs,
  SQL dumps, SQLite/database files, backup archives and non-example `.env`
  files in the offline package.
- This avoids a false blocker where the package builder correctly included
  empty field templates but the release guard rejected the `qa\` path itself.

Verification after correction:

- `scripts\assert_offline_release_clean.ps1 -SelfTest` returned `SelfTest
  passed`, confirming that only the five final-field `qa\*.example.md`
  templates are allowed by the guard.
- `scripts\final_production_handoff.ps1 -SkipPreflight` now runs the same
  self-test, records `Offline release guard self-test exit code: 0` and embeds
  the self-test output in the handoff evidence report.
- `scripts\validate_final_handoff_completeness.ps1` now requires the handoff
  to mention the offline release guard self-test, the preserved command and
  the exact allowlist output before it reports `FINAL_HANDOFF_COMPLETENESS: YES`.
- Positive synthetic guard fixture:
  `scripts\make_offline_release.ps1 -ReleaseRoot C:\tmp\s_hospital_offline_guard_templates -Force -AllowDirty -SkipDockerBuild -SkipDockerSave -SkipGuard`
  plus checksum-only synthetic tar files allowed the guard to reach package
  structure checks without touching the real package or Docker.
- `scripts\assert_offline_release_clean.ps1 -ReleaseRoot C:\tmp\s_hospital_offline_guard_templates -RequireCurrentCommit`
  returned `OFFLINE_RELEASE_CLEAN: YES` when only the five `qa\*.example.md`
  proof templates were present.
- Negative synthetic guard fixture:
  adding `qa\FINAL_RESTORE_PROOF.md` to the same temporary package returned
  `OFFLINE_RELEASE_CLEAN: NO (1 blocking issue)` with
  `Forbidden file or directory in offline release: qa/FINAL_RESTORE_PROOF.md`.
- Current real `offline-release` remains blocked with
  `OFFLINE_RELEASE_CLEAN: NO (44 blocking issues)` until it is regenerated from
  the final commit with real Docker image exports and the stack-autostart
  script.

Required next action before delivery:

- Regenerate `offline-release` from the final commit with real Docker image exports.
- Re-run `scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit`.
- Keep the system as `PRODUCTION_CANDIDATE` until this guard passes together with final LAN, printer, backup worker, restore, concurrency and production preflight evidence.
