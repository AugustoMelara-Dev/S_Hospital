# Production license salt guard - 2026-06-04

Decision: `PASS`.

Scope:

- Prevent production startup with missing or short `HOSPITAL_LICENSE_SALT`.
- Require the production Docker Compose environment to provide the salt for the
  backend and backup scheduler containers.
- Keep local development and automated tests usable without a real production
  salt.

Observed result:

- `AppServiceProvider` rejects production boot when the configured salt is
  empty or shorter than 32 characters.
- The same provider allows `testing` and non-production environments to run
  without a real hospital salt.
- `docker-compose.prod.yml` now fails closed if `HOSPITAL_LICENSE_SALT` is not
  provided.
- `scripts/validate_production_license_salt_guard.ps1` verifies the Laravel
  provider, unit-test coverage, production compose interpolation, docs and
  pre-commit secret guard without printing a real salt.

Commands run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_production_license_salt_guard.ps1
docker compose exec -T backend php artisan test --filter=LicenseSaltGuardTest
docker compose exec -T backend ./vendor/bin/pint --test app/Providers/AppServiceProvider.php tests/Unit/LicenseSaltGuardTest.php
powershell -NoProfile -ExecutionPolicy Bypass -Command "`$env:HOSPITAL_LICENSE_SALT='0123456789abcdef0123456789abcdef'; `$env:SERVER_IP='192.168.1.10'; docker compose -f docker-compose.prod.yml config --quiet"
```

The compose validation exited `0` with a disposable placeholder value; no real
production salt was used or printed.

Expected guard marker:

```text
PRODUCTION_LICENSE_SALT_GUARD: YES
```

Safety notes:

- No `.env` file was read, edited or deleted.
- No real salt value was printed or committed.
- This guard does not validate fiscal compliance; it only prevents a weak
  production license-signing salt.
