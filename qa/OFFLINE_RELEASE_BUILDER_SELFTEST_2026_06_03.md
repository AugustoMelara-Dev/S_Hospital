# Offline release builder self-test evidence - 2026-06-03

Decision: `PASSED_LOCAL_SELFTEST`.

Scope:

- Validate that `scripts\make_offline_release.ps1 -SelfTest` can simulate the packaged file layout without building Docker images or touching the real `offline-release` directory.
- Confirm that the simulated bundle includes root `setup.bat`, nginx config/crontab, critical operational scripts, non-technical operator docs and QA proof templates needed after installation.
- Confirm that `scripts\release_setup.bat` is replaced by the root launcher in the simulated bundle.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -SelfTest
```

Observed result:

- `SelfTest passed`.
- `nginx/default.conf` remained 108 lines and matched source hash `9A27BC9EC6BD8C54C693CAF302557C1B93F7EB37EEFA3D38D8F052CECD34EA60`.
- 35 critical scripts were present in the simulated bundle, including preflight, handoff, dependency manifest validation, LAN validation, proof initialization, backup task helpers and operational safety validators.
- 7 critical docs were present in the simulated bundle, including release checklist and role/support/backup manuals.
- 5 QA proof templates were present in the simulated bundle, including LAN, printer, restore, concurrency and anonymous training acceptance templates.

Safety notes:

- This self-test used a temporary directory only.
- It did not regenerate `offline-release`.
- It did not build or save Docker images.
- It did not read, copy, print or delete `.env`, database volumes, backup SQL files or production data.
