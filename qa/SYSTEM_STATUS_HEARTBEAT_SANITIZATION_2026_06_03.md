# System status heartbeat sanitization - 2026-06-03

Decision: `PASS`.

Scope:

- Verify that `/api/system/status` does not expose raw scheduler heartbeat messages when cache contains technical failures.
- Protect admin/support diagnostics from secrets, local Windows paths and SQL/stack-trace wording.

Command run:

```powershell
docker compose exec -T backend php artisan test --filter=SystemStatusTest
```

Observed result:

- `Tests: 14 passed (80 assertions)`.
- Added coverage for `scheduler_heartbeat.last_message` sanitization.
- A cached message containing `SQLSTATE`, `DB_PASSWORD=supersecret`, `.env` and `C:\Projects\S_Hospital` is returned as `Error tecnico registrado. Revise el paquete de soporte.`

Safety notes:

- This was a test-only change using Laravel's test database refresh.
- No production `.env`, backup, database volume or real hospital data was changed.
- The endpoint remains restricted to users with `system.status.view`.
