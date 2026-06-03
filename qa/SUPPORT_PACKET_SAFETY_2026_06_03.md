# Support packet safety evidence - 2026-06-03

Decision: `PASS`.

Scope:

- Validate that `scripts\collect_support_packet.ps1` can create a support packet without copying `.env`.
- Validate that secrets and local filesystem paths from logs/diagnostics are redacted before support artifacts are written.
- Validate that `-WhatIfOnly` confirms parameters without creating folders or copying logs.

Commands run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\collect_support_packet.ps1 -WhatIfOnly -TailLines 5 -RepairRetries 1 -RepairDelaySeconds 1
```

Observed result:

- `SUPPORT_PACKET_SAFETY: YES`.
- No `.env` files were copied into the support packet.
- Fixture values for `APP_KEY`, `DB_PASSWORD`, `TOKEN` and `MAIL_PASSWORD` did not appear in generated support files.
- Local Windows and Linux paths in the fixture were replaced with `%PROJECT_ROOT%` or `[ruta-local]`.
- `collect_support_packet.ps1 -WhatIfOnly` completed without creating a folder or copying logs.

Safety notes:

- The validation used a disposable fixture and removed it after the check.
- No real backup SQL, database volume or `.env` file was read into evidence.
- This validates support packet safety in the local audit environment only; final support handoff should still remind staff not to attach `.env`, SQL backups, passwords, tokens or full data folders.
