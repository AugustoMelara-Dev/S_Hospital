# Training acceptance proof

Decision: `PENDING_FINAL_FIELD`.

This file is reserved for final supervised staff training. It must stay pending
until cashier, supervisor and administrator practice is completed in an isolated
practice environment or approved disposable database.

Do not write participant names, patient names, phone numbers, identity numbers,
usernames, passwords, `.env` values, backup SQL filenames or local machine
paths. Use `qa/TRAINING_ACCEPTANCE_PROOF.example.md` as the completion template
after real supervised training.

## Current blockers

- Falta completar capacitacion supervisada del rol cajero en un ambiente seguro.
- Falta completar capacitacion supervisada del rol supervisor en un ambiente seguro.
- Falta completar capacitacion supervisada del rol administrador en un ambiente seguro.
- Falta practicar incidentes de servidor, red LAN, impresora, energia, caja,
  respaldo, sesion, permisos y restauracion solo en una base descartable.
- Falta guardar evidencia anonima bajo `qa/` o referencia fisica verificable.
- Falta confirmar que la capacitacion no uso datos reales de pacientes ni la base
  de produccion.

## Resultado operativo

Mientras este archivo siga pendiente, `scripts\production_readiness_preflight.ps1`
debe fallar y cualquier entrega debe quedar como `PRODUCTION_CANDIDATE`, no como
`PRODUCTION_READY`.
