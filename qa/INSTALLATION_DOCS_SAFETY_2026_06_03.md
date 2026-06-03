# Installation docs safety evidence - 2026-06-03

Decision: `PASSED`.

Scope:

- Validate that `docs\manuales\GUIA_INSTALACION_OPERATIVA.md` keeps the
  non-technical installation, startup, LAN URL, backup task, repair and support
  instructions required for hospital handoff.
- Ensure the final handoff keeps checking installation documentation before any
  `PRODUCTION_READY` decision.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installation_docs_safety.ps1
```

Observed result:

- `INSTALLATION_DOCS_SAFETY: YES`.
- The guide includes conservative install rules: no data folders or database
  volumes are deleted, no clean install option over prior data, no
  `migrate:fresh`, no demo seeders and `APP_VERSION` remains required.
- The guide includes safe LAN access: `http://IP-DEL-SERVIDOR:8000`, no
  credentials in URLs and `APP_URL` configured for LAN clients.
- The guide includes startup, shortcut, backup worker, daily backup, current
  user fallback, repair, support packet and evidence-path safety checks.
- The guide keeps final blockers for LAN client, printer, restore and
  concurrency evidence, and keeps status as `PRODUCTION_CANDIDATE`.
- The guide documents guided handoff with `-InitializeProofFiles` so missing
  proof drafts are created without overwriting real evidence.
- The release checklist requires both `make_offline_release.ps1 -SelfTest` and
  `validate_dependency_manifest.ps1` before regenerating or handing off the
  offline package.
- The primary installation, first-level support and backup/restore guides use
  `-NoProfile` in documented PowerShell commands to avoid operator profile
  startup issues during recovery.

Safety notes:

- This was a read-only documentation guard.
- No `.env`, database, backup SQL, Docker volume or production data was touched.
- No physical evidence was invented; final server, LAN client and printer proof
  remain required.
