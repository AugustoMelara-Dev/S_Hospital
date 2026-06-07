# MariaDB migration validation - 2026-06-07

## Decision

`PASSED` for local Docker/MariaDB migration compatibility.

This evidence validates a disposable local MariaDB database only. It does not
replace final-server restore proof, second-client LAN proof, concurrency proof,
or physical institutional receipt proof.

## Environment

- Workspace: `C:\Projects\S_Hospital`
- Database engine: Docker `mariadb:11`
- Host port: `3307`
- Validation database: `s_hospital_migration_clean_20260607`
- Production data reset: no
- Existing development database reset: no

## Commands

```powershell
$env:DB_PORT='3307'; docker compose up -d mysql
$env:DB_PORT='3307'; docker compose exec -T mysql mariadb -uroot -p*** -e "CREATE DATABASE IF NOT EXISTS s_hospital_migration_clean_20260607 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON s_hospital_migration_clean_20260607.* TO 'hospital'@'%'; FLUSH PRIVILEGES;"
```

```powershell
$env:DB_CONNECTION='mysql'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3307'
$env:DB_DATABASE='s_hospital_migration_clean_20260607'
$env:DB_USERNAME='hospital'
$env:DB_PASSWORD='***'
php artisan migrate --force --no-interaction
```

## Result

- Laravel created the migration table successfully.
- All 46 migrations ran successfully from an empty MariaDB schema.
- `fiscal_settings.receipt_width` is now `varchar(32)` with default `half_letter`.
- `service_price_histories.service_id` is nullable.
- `service_price_histories_service_id_foreign` uses `ON DELETE SET NULL`.

## Verification Query Output

```text
migration_count
46

Field           Type        Null  Key  Default      Extra
receipt_width   varchar(32) NO         half_letter

Field       Type                 Null  Key  Default  Extra
service_id  bigint(20) unsigned  YES   MUL  NULL

CONSTRAINT_NAME                               DELETE_RULE
service_price_histories_changed_by_foreign    SET NULL
service_price_histories_service_id_foreign    SET NULL
```

## Remaining Physical Evidence

- Final server migration/restore validation remains required before declaring
  `PRODUCTION_READY`.
- This local proof does not replace second-client LAN validation.
- This local proof does not replace physical printer validation for media
  carta, carta or A5.
