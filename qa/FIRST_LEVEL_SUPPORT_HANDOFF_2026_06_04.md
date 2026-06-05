# First-level support handoff integration - 2026-06-04

## Scope

This microphase makes the final production handoff run and preserve the first-level support safety guard.

## Files changed

- `scripts/final_production_handoff.ps1`
- `scripts/validate_final_handoff_completeness.ps1`
- `qa/FIRST_LEVEL_SUPPORT_HANDOFF_2026_06_04.md`

## Safety contract

- The handoff must execute `scripts/validate_first_level_support_safety.ps1`.
- The handoff report must include the guard exit code and output section.
- `scripts/validate_final_handoff_completeness.ps1` must fail if the report omits `FIRST_LEVEL_SUPPORT_SAFETY: YES`.
- Final field proof validation remains opt-in through `-IncludeFieldProofs`; the default guard path only self-tests final physical blockers.

## Planned verification

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_first_level_support_safety.ps1 -SelfTest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_first_level_support_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_handoff_guard_coverage.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -SelfTest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-branding.ps1
```

## Production notes

- No `.env` file is deleted.
- No database volume is reset.
- No restore is executed against production data.
- No fiscal compliance is invented by this evidence.
- No push is performed by this phase.
