# First level support safety - 2026-06-04

## Scope

Add a single non-destructive quick check for first-level support before or after
installation. The command groups the human-facing support guards that protect
operator manuals, incident recovery, safe training, support packet redaction and
final-field blocker visibility.

This phase does not replace the full production handoff and does not complete
physical LAN or printer validation.

## Files changed

- `scripts/validate_first_level_support_safety.ps1`
- `scripts/validate_final_field_blockers_safety.ps1`
- `scripts/make_offline_release.ps1`
- `scripts/assert_offline_release_clean.ps1`
- `qa/FIRST_LEVEL_SUPPORT_SAFETY_2026_06_04.md`

## Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_first_level_support_safety.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_first_level_support_safety.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -SelfTest
```

## Expected interpretation

- `-SelfTest` confirms the quick check knows every required guard and avoids
  destructive reset patterns.
- Default live mode runs support/manual/training/sanitization guards and only
  runs `validate_final_field_blockers_safety.ps1 -SelfTest`.
- Final-field proof live validation remains opt-in through `-IncludeFieldProofs`
  because it may correctly fail until the hospital has real LAN, printer,
  restore and concurrency evidence.
- The final-field blocker self-test now explicitly preserves 80mm/58mm printer
  blockers instead of only checking media carta/carta/A5.

## Safety notes

- No `.env` file was edited, deleted or committed.
- No database command, restore, migration or seed was executed.
- No support packet with real secrets was committed.
- No physical proof was synthesized.
- No push was performed.
- No fiscal compliance was invented.
