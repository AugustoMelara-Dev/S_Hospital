# System diagnostics safety evidence - 2026-06-03

Decision: `PASSED`.

Scope:

- Validate that **Informacion del sistema** keeps cashier-safe summaries:
  `Todo bien`, `Requiere revision` and `Error`.
- Validate that advanced diagnostics remain gated by `system.status.view` and
  cover backend, database, frontend build, last backup, queue, server time,
  disk space, LAN access, installed version and migrations.
- Validate that the admin/support diagnostics include a Recharts-based
  operational pulse for backups, failed jobs, scheduler heartbeat, disk space
  pending migrations, queue size, database lag and backend uptime, with a
  textual support reading beside the chart.
- Validate that `/api/system/status` keeps sanitized URLs/messages and does not
  expose secret-like assignments.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_system_diagnostics_safety.ps1
```

Observed result:

- `SYSTEM_DIAGNOSTICS_SAFETY: YES`.
- Frontend diagnostics keep non-technical labels and hide raw technical details
  from normal users.
- Backend diagnostics keep environment, database, frontend, network, backup,
  runtime, readiness and preflight sections with sanitized operational fields.
- Admin diagnostics now include `Pulso operativo administrativo` and
  `Lectura para soporte`; the focused UI test verifies the panel without raw
  queue commands, paths or secret-like values.
- Admin diagnostics consume the public operational health snapshot for
  `Cola LAN`, `Retardo DB`, `Disco` and `Actividad` labels without exposing
  storage paths, SQL probes, queue commands or secret-like values.
- Browser evidence: `qa/screenshots/system-diagnostics-admin-pulse-2026-06-04/about-admin-pulse-light.png`
  and `qa/screenshots/system-diagnostics-admin-pulse-2026-06-04/about-admin-pulse-report.json`
  were generated with mocked API data, no mutations, no forbidden text and no
  console issues.
- Extended browser evidence:
  `qa/screenshots/system-diagnostics-admin-health-2026-06-04/about-admin-health-light.png`
  and
  `qa/screenshots/system-diagnostics-admin-health-2026-06-04/about-admin-health-report.json`
  confirm the admin panel renders the new operational health metrics with
  mocked API data, no mutations, no forbidden text and no console issues.
- Existing focused frontend/backend tests cover safe summaries, permission-gated
  diagnostics and secret/path sanitization.

Safety notes:

- This was a read-only source/test guard.
- No `.env`, database, backup SQL, Docker volume or production data was touched.
- Final server/LAN/printer evidence remains required before production handoff.
