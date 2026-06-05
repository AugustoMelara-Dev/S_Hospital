# Final startup task proof

Decision: PENDING_FINAL_FIELD

This file is intentionally incomplete. Use
`qa/FINAL_STARTUP_TASK_PROOF.example.md` as the completion template after the
real final server has the stack autostart task installed or updated and an
arranque/reinicio smoke has been observed.

Required before `PRODUCTION_READY`:

- Install or update `SistemaCajaHospitalaria-StackAutostart` on the final
  server.
- Confirm the task is Ready or Running.
- Confirm the trigger is `AtStartup`.
- Confirm the task action points to the supported hospital startup script and
  not a destructive, demo or seed command.
- Observe a server startup, reboot or supervised manual task start after
  services were stopped.
- Confirm `/up` and the login page are reachable after startup without
  internet.
- Save safe evidence under `qa/` or a physical support reference without
  `.env`, passwords, task XML exports, SQL dumps or absolute local paths.

Until this file is completed with real final-server evidence, keep the handoff
as `PRODUCTION_CANDIDATE`.
