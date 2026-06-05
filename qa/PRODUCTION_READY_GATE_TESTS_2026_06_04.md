# Production ready gate tests - 2026-06-04

## Scope

Add a non-destructive PowerShell test that protects the final production-ready
contract without requiring a running server, physical LAN client, printer,
database restore target or secrets.

This phase does not declare `PRODUCTION_READY`. It verifies that the scripts
still require real final evidence before that decision can be produced.

## Files added

- `backend/tests/PowerShell/production-ready-gate.tests.ps1`
- `qa/PRODUCTION_READY_GATE_TESTS_2026_06_04.md`

## Checks covered

- `scripts/production_readiness_preflight.ps1` keeps
  `-AllowMissingPhysicalProof` as a blocking bypass flag.
- The preflight still requires:
  - `qa/LAN_CLIENT_VALIDATION_PROOF.md`
  - `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
  - `qa/FINAL_RESTORE_PROOF.md`
  - `qa/FINAL_CONCURRENCY_PROOF.md`
- The preflight still rejects incomplete proof markers such as `TODO`,
  `PENDING_*`, `REPLACE`, `N/A`, `TBD`, example/template text and unchecked
  checklist items.
- The preflight keeps critical proof checks for LAN, billing, payment, receipt,
  backup, printer media sizes, restore and concurrency.
- `scripts/final_production_handoff.ps1` still gates `PRODUCTION_READY` on
  completed proofs, automated guards, no skipped preflight and a successful
  preflight exit code.
- `scripts/validate_ops_evidence_index.ps1` and
  `scripts/validate_final_handoff_completeness.ps1` still preserve the evidence
  guardrail.

## Command run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend\tests\PowerShell\production-ready-gate.tests.ps1
```

Result:

```text
PRODUCTION_READY_GATE_TESTS: YES
```

## Safety notes

- No `.env` file was read into evidence, edited, deleted or committed.
- No database reset, restore or migration was executed.
- No production data was touched.
- No browser, LAN client or printer evidence was simulated as real field proof.
- No push was performed.
- No fiscal compliance was invented.

## Remaining field blockers

- Complete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a real second hospital LAN
  client.
- Complete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` on the real cashier
  printer for media carta, carta, A5, 80mm and 58mm.
- Re-run final restore and concurrency proof on the final server or an approved
  disposable final-field target.
- Run `scripts/production_readiness_preflight.ps1` without bypass flags on the
  final LAN URL.
