# LAN client proof guard

Date: 2026-06-05

## Scope

This evidence records the validation guard for
`qa\LAN_CLIENT_VALIDATION_PROOF.md`, the final proof that must be completed from
a real second computer on the hospital LAN before `PRODUCTION_READY`.

## Contract

- `scripts\validate_lan_client_proof.ps1 -AllowPendingFinalField` must pass
  while the proof is still pending and must preserve blockers for second PC,
  final LAN IP/name, login without 419/session expiry, caja, invoice, payment,
  receipt, history/reprint, reports, UI backup and `PRODUCTION_CANDIDATE`.
- `scripts\validate_lan_client_proof.ps1` without the pending flag must fail
  until `qa\LAN_CLIENT_VALIDATION_PROOF.md` has completed fields, checked
  evidence items and safe relative evidence references.
- The offline release builder and guard include the script and compare it with
  the versioned source.
- The final handoff lists the guard as part of the release evidence commands.

## Validation summary

- Pending guard mode: expected pass.
- Final guard mode: expected fail until a real second LAN client proof exists.
- This guard does not replace the physical LAN test and does not close the
  final field blocker.
