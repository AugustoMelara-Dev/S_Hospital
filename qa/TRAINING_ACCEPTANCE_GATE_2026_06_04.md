# Training acceptance gate

- Date: 2026-06-04
- Decision: `PRODUCTION_CANDIDATE`
- Scope: add supervised training acceptance as a required final field proof before
  any handoff can be treated as `PRODUCTION_READY`.

## Safety contract

- `qa/TRAINING_ACCEPTANCE_PROOF.md` starts as `PENDING_FINAL_FIELD`.
- The proof must only be completed after cashier, supervisor and administrator
  practice in an isolated training environment or disposable database.
- The proof must not include participant names, patient data, passwords, `.env`
  values, backup SQL filenames or local machine paths.
- If the proof is missing, incomplete or bypassed, preflight and handoff must keep
  the system as `PRODUCTION_CANDIDATE`.

## Evidence

- `scripts/production_readiness_preflight.ps1` requires training acceptance proof
  with safe-environment checks and critical incident drills.
- `scripts/final_production_handoff.ps1` lists the proof status, blocker and next
  action.
- `scripts/validate_final_handoff_completeness.ps1`,
  `scripts/validate_production_ready_gate_safety.ps1`,
  `scripts/validate_operations_objective_audit.ps1` and
  `scripts/validate_ops_evidence_index.ps1` guard the new contract.
- `qa/TRAINING_ACCEPTANCE_HANDOFF_RESULT_2026_06_04.md` confirms the current
  handoff remains blocked until real supervised training evidence exists.

## Validation commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_production_ready_gate_safety.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_operations_objective_audit.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_ops_evidence_index.ps1 -HandoffPath qa\TRAINING_ACCEPTANCE_HANDOFF_RESULT_2026_06_04.md
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_handoff_completeness.ps1 -HandoffPath qa\TRAINING_ACCEPTANCE_HANDOFF_RESULT_2026_06_04.md
```
