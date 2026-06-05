# Final backup task proof

Decision: `PENDING_FINAL_FIELD`.

This file is reserved for the final hospital server. It must stay pending until
Windows backup tasks are installed or updated on that server and one manual
backup created from the admin UI moves from pending to success/completed.

Do not write passwords, `.env` values, SQL dump contents, task XML exports,
database credentials or absolute local machine paths. Use
`qa/FINAL_BACKUP_TASK_PROOF.example.md` as the completion template after the real
server validation.

## Current blockers

- Falta instalar o actualizar `SistemaCajaHospitalaria-BackupWorker` en el
  servidor final.
- Falta instalar o actualizar `SistemaCajaHospitalaria-DailyBackup` en el
  servidor final.
- Falta iniciar u observar el worker de respaldos corriendo en el servidor final.
- Falta crear un respaldo manual desde la UI administrativa.
- Falta confirmar que el respaldo manual pasa de `pending` a `success` o
  `completed`.
- Falta guardar evidencia anonima bajo `qa/` o una referencia fisica/verificable
  sin `.env`, dumps SQL, passwords, XML de tareas ni rutas absolutas.

## Resultado operativo

Mientras este archivo siga pendiente, `scripts\production_readiness_preflight.ps1`
debe fallar y cualquier entrega debe quedar como `PRODUCTION_CANDIDATE`, no como
`PRODUCTION_READY`.
