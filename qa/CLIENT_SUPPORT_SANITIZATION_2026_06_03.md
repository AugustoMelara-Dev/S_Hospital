# Client support sanitization - 2026-06-03

Decision: `PASS`.

Scope:

- Verify that frontend support summaries and backend system diagnostics hide direct `.env` file mentions.
- Keep cashier/support-facing incident evidence useful without exposing protected configuration filenames, secrets or local paths.

Commands run:

```powershell
docker compose exec -T backend php artisan test --filter=SystemStatusTest
npm.cmd test -- clientIssueLog.test.ts
```

Observed result:

- Backend: `Tests: 15 passed (84 assertions)`.
- Frontend: `1 passed (1)`, `6 passed (6)`.
- `scheduler_heartbeat.last_message` now redacts standalone `.env.*` mentions before `/api/system/status` returns them.
- `safeClientMessage()` now redacts standalone `.env.*` mentions before storing or summarizing browser incidents.

Safety notes:

- No `.env`, backup SQL, database volume or production data was changed.
- This evidence only covers sanitizer behavior; final support workflow still requires browser smoke evidence on the installed server.
