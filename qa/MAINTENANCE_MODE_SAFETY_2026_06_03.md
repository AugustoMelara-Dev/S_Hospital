# Maintenance mode safety evidence - 2026-06-03

Decision: `PASSED`.

Scope:

- Verify that `php artisan hospital:maintenance on/off` is available for
  supervised incidents.
- Confirm that enabling maintenance writes only Laravel's maintenance flag and
  does not touch data, backups, Docker volumes or `.env`.
- Confirm that cashier-facing HTML and API responses use human Spanish wording
  without raw paths, secrets or stack traces.
- Confirm that operator docs and known limitations no longer treat the command
  as missing.

Commands run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_maintenance_mode_safety.ps1
```

```powershell
docker compose exec -T backend php artisan test --filter=MaintenanceModeTest
```

Observed result:

- `MAINTENANCE_MODE_SAFETY: YES`.
- `MaintenanceModeTest` passed with 3 tests and 17 assertions.
- `MaintenanceCommand` requires explicit `on` or `off`, supports an
  operator-facing `--message`, writes `status: 503` and `retry: 60`, and
  removes only `storage/framework/down` when disabled.
- The HTML page says `Sistema en mantenimiento` and tells staff to contact the
  supervisor, not a developer.
- API requests receive `Sistema en mantenimiento. Vuelva a intentar en unos
  minutos.` without internal file paths or secret-like values.
- The operator index documents how to activate and deactivate maintenance mode.
- `docs\KNOWN_LIMITATIONS.md` records the command as closed, not as pending
  v1.1 work.

Safety notes:

- This validation did not run migrations, seeders, restore commands, Docker
  destructive commands or backup deletion.
- The feature test creates and removes the Laravel maintenance flag in the test
  environment only.
- This does not replace final-server incident drills with hospital staff.
