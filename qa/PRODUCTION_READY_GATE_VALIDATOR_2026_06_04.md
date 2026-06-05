# Production ready gate validator - 2026-06-04

## Scope

Promote the `PRODUCTION_READY` evidence gate from a repository-only PowerShell
test into an operational validator that travels with the offline support
package.

This phase does not approve production use. It only makes the release package
harder to close incorrectly when physical LAN, printer, restore or concurrency
proof is missing.

## Files changed

- `scripts/validate_production_ready_gate_safety.ps1`
- `backend/tests/PowerShell/production-ready-gate.tests.ps1`
- `scripts/make_offline_release.ps1`
- `scripts/assert_offline_release_clean.ps1`
- `qa/PRODUCTION_READY_GATE_VALIDATOR_2026_06_04.md`

## Operational contract protected

- `-AllowMissingPhysicalProof` remains a blocking bypass flag.
- `qa/LAN_CLIENT_VALIDATION_PROOF.md`,
  `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`,
  `qa/FINAL_RESTORE_PROOF.md` and
  `qa/FINAL_CONCURRENCY_PROOF.md` remain required before production readiness.
- Incomplete proof markers remain blocked.
- Final handoff still requires completed proofs, automated guards, no skipped
  preflight and successful preflight exit before `PRODUCTION_READY`.
- The offline release builder and guard now require
  `scripts/validate_production_ready_gate_safety.ps1`.

## Commands run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_production_ready_gate_safety.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File backend\tests\PowerShell\production-ready-gate.tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -SelfTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -SelfTest
```

Result:

```text
PRODUCTION_READY_GATE_SAFETY: YES
PRODUCTION_READY_GATE_TESTS: YES
[OK] SelfTest passed. Only final-field qa/*.example.md templates are allowed in offline release.
make_offline_release.ps1 -SelfTest: blocked by existing dirty nginx/default.conf at 76 lines; guard requires >= 80 lines.
```

The builder self-test failure is outside this phase because `nginx/default.conf`
was already dirty in the shared worktree. This phase only fixes the early
diagnostic path so the self-test reports the real release blocker instead of an
undefined `Write-Fail` PowerShell error.

## Safety notes

- No `.env` file was edited, deleted or committed.
- No database command, restore, migration or seed was executed.
- No physical evidence was synthesized.
- No push was performed.
- No fiscal compliance was invented.

## Remaining blockers

- Real second-client LAN proof.
- Real physical printer proof for media carta, carta and A5.
- Final-server restore proof against a disposable database.
- Final-field concurrency proof against a disposable target.
- Final preflight without bypass flags on the installed LAN URL.
