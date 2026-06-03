# Local production preflight evidence

- Date/time: 2026-06-03 04:59 America/Tegucigalpa
- Base URL tested: `http://127.0.0.1:8000`
- Command: `scripts/production_readiness_preflight.ps1 -BaseUrl http://127.0.0.1:8000`
- Final result: `PRODUCTION_READY: NO`
- Blocking issues reported: 11

## Passed automated checks

- APP_KEY is set to a non-placeholder value.
- DB_CONNECTION is `mysql`.
- SANCTUM stateful domains include the LAN host.
- CORS origins are explicitly empty for same-origin production.
- CORS origin patterns are empty.
- QUEUE_CONNECTION is `database`.
- `frontend/dist/index.html` exists.
- Built frontend assets exist.
- PHP is available in PATH.
- MySQL client is available.
- Database dump tool is available.
- Backup directory is writable.
- `/up`, `/login`, and `/verify-email` responded successfully.
- Final restore evidence is present and completed.

## Remaining blockers

- APP_ENV is `local`; final server must use production.
- APP_DEBUG is `true`; final server must disable debug.
- APP_URL does not match the tested localhost URL.
- DB_PASSWORD uses a known development value in this local environment.
- DB_ROOT_PASSWORD is empty in this local environment.
- BaseUrl is localhost; final proof must use final LAN IP or local domain.
- Windows scheduled backup worker task is not installed.
- Windows scheduled daily backup task is not installed.
- LAN client validation proof is still incomplete.
- Physical institutional receipt printer proof is still incomplete.
- Final concurrency proof is still incomplete.

## Scope

This preflight was run against the local Docker development environment. It is evidence for the hardening front, not permission to declare the installed hospital server production ready.
