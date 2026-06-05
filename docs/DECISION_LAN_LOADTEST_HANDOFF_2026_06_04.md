# Decision: LAN/loadtest guard in final handoff

Date: 2026-06-04

## Context

LAN emulation and load-test runners now exist for validation-only targets. These
runners create invoices and may register payments, so their safety rules must be
part of the final handoff and offline package, not only a manual checklist.

## Decision

`scripts\final_production_handoff.ps1` runs
`scripts\validate_lan_loadtest_safety.ps1`, records its output in the handoff
report, and includes its exit code in the automated gate decision.

The offline package builder and guard now include and compare
`scripts\validate_lan_loadtest_safety.ps1` with the versioned source. Handoff
coverage and final handoff completeness guards also require the script and its
reported output.

## Verification

Required checks:

- `scripts\validate_lan_loadtest_safety.ps1`
- `scripts\validate_handoff_guard_coverage.ps1`
- `scripts\validate_final_handoff_completeness.ps1`
- `scripts\make_offline_release.ps1 -SelfTest`
- `scripts\assert_offline_release_clean.ps1 -SelfTest`
- `scripts\final_production_handoff.ps1 -SkipPreflight`

The handoff remains `PRODUCTION_CANDIDATE` until physical LAN, printer,
training and current offline release evidence are complete.
