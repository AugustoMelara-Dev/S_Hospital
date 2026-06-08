# Final field blockers safety - 2026-06-04

## Scope

Add a guard that checks the final-field proof files stay honest while the
hospital still lacks real LAN, printer, startup, backup, restore, concurrency
and training evidence.

This phase does not complete field validation. It prevents support from losing
the explicit blocker list, especially physical printer page-format requirements
for media carta, carta and A5, backup status wording and supervised role
training including area-user paid-service consultation.

## Files changed

- `scripts/validate_final_field_blockers_safety.ps1`
- `scripts/make_offline_release.ps1`
- `scripts/assert_offline_release_clean.ps1`
- `qa/FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md`

## Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_field_blockers_safety.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_field_blockers_safety.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -SelfTest
```

## Expected interpretation

- `-SelfTest` must pass. It proves the guard rejects a printer proof that drops
  any required institutional page-format blocker.
- Live mode may fail in this shared worktree while
  `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` is dirty or no longer preserves the
  required media carta, carta and A5 physical blockers.
- `scripts/validate_production_ready_gate_safety.ps1` may also fail in this
  shared worktree while `scripts/production_readiness_preflight.ps1` is dirty
  or missing institutional receipt proof requirements. The versioned `HEAD`
  still contains those requirements.
- A live failure is a useful safety signal, not permission to synthesize
  hardware evidence.

## Safety notes

- No `.env` file was edited, deleted or committed.
- No database command, restore, migration or seed was executed.
- No physical LAN or printer proof was invented.
- No push was performed.
- No fiscal compliance was invented.

## Remaining blockers

- Complete second-client LAN proof from a real hospital LAN workstation.
- Complete physical printer proof for media carta, carta and A5.
- Complete final-server startup/autostart proof.
- Complete final-server backup task proof and manual backup UI transition.
- Complete final-server restore proof against a disposable database.
- Complete final-field concurrency proof against a disposable target.
- Complete supervised training proof for cashier, supervisor, administrator and
  area-user roles without names, patient data or secrets.
- Run final preflight on the installed LAN URL without bypass flags.
