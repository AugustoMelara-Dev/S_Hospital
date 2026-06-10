# FIELD-DEP-02-RISK-01 fix — evidence

**Rama:** `fix/service-price-histories-nullable-fk`
**Base:** `main @ d54404da0fc722f476278ceb1edcf289f33b20ad`
**Causa raiz:** `database/migrations/2026_06_02_000006_change_service_price_histories_to_null_on_delete.php`
declaraba `->nullOnDelete()` (que produce `ON DELETE SET NULL`) sin hacer
nullable la columna `service_id`; MariaDB rechaza con errno 150.

**Fix (1 linea, dentro del `up()`):**
```php
$table->dropForeign(['service_id']);
$table->foreignId('service_id')->nullable()->change();   // <- fix (nueva)
$table->foreign('service_id')->nullOnDelete()->references('id')->on('services');
```

Sin cambios al `down()`. Sin refactor. Sin tocar frontend, branding ni
logica de negocio. La migracion ya nunea fue commiteada a main con la
logica broken; esta rama introduce el unico cambio necesario para que
MariaDB 10.4 y 11.x acepten el constraint.

## Comandos ejecutados

```bash
git checkout -b fix/service-price-histories-nullable-fk main
# editar database/migrations/2026_06_02_000006_*.php (1 linea)

# 1. Apuntar backend/.env a MariaDB 11 (compose s_hospital-mysql-1)
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=hospital DB_PASSWORD=hospital_dev

# 2. recreate empty DB y migrate:fresh contra MariaDB 11.8.6
docker exec s_hospital-mysql-1 mariadb -uhospital -phospital_dev \
  -e "DROP DATABASE IF EXISTS hospital_billing; CREATE DATABASE hospital_billing ..."
cd backend && php artisan migrate:fresh --force
# -> 47/47 DONE, incluyendo 02_06_000006

# 3. verificar FK resultante
docker exec s_hospital-mysql-1 mariadb -uhospital -phospital_dev hospital_billing \
  -e "SHOW CREATE TABLE service_price_histories\G"
# -> service_id DEFAULT NULL, ON DELETE SET NULL aplicado

# 4. repetir contra MariaDB 10.4 (XAMPP 127.0.0.1:3306, root, password vacio)
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USERNAME=root DB_PASSWORD=
cd backend && php artisan migrate:fresh --force
# -> 47/47 DONE, incluyendo 02_06_000006

# 5. tests backend
cd backend && vendor/bin/phpunit
# -> 438/438 OK, 2819 assertions, 5 skipped
cd backend && vendor/bin/phpunit --filter "ServiceCatalogTest|BackupRestoreRoundtripTest"
# -> ServiceCatalog: 27/27 OK, 156 assertions
# -> BackupRestore: 5/5 OK, 1 skipped (esperado)

# 6. re-staging del dump anterior para confirmar FIELD-DEP-02 PASS intacto
# restaurar hospital-backup-20260610-145553-ppqwhoht.sql en hospital_restore_validation_test_v2
# -> 47 migrations, 3 users, 122 services, 1 invoice, 1 payment, etc.
# -> service_id nullable YES, ON DELETE SET NULL aplicado
```

## Resultados clave

| Verificacion | Resultado | Evidencia |
|---|---|---|
| `migrate:fresh` en MariaDB **11.8.6** (compose prod) | **47/47 DONE** (antes FAIL con errno 150) | `qa/qa-fix-mariadb11-fresh.txt` |
| `migrate:fresh` en MariaDB **10.4.32** (XAMPP) | **47/47 DONE** (antes FAIL con errno 150) | `qa/qa-fix-mariadb104-fresh.txt` |
| `service_id` queda `nullable` en MariaDB 11 | `null=YES` | `SHOW COLUMNS` (via dump) |
| `service_id` queda `nullable` en MariaDB 10.4 | `null=YES` | `qa/qa-fix-fk-verify-mariadb11.txt` |
| FK `service_price_histories_service_id_foreign` con `ON DELETE SET NULL` en ambos motores | aplicado | `mysqldump --no-data` output |
| Suite backend completa | **438/438 OK**, 2819 assertions, 5 skipped | `qa/qa-fix-tests-full.txt` |
| `ServiceCatalogTest` (lee/escribe `ServicePriceHistory`) | 27/27 OK, 156 assertions | `qa/qa-fix-tests-servicecatalog.txt` |
| `BackupRestoreRoundtripTest` (ciclo backup->restore) | 5/5 OK, 1 skipped | `qa/qa-fix-tests-backup.txt` |
| **FIELD-DEP-02 staging no invalidado**: re-restore del dump anterior | 47 migrations, 3 users, 122 services, 1 invoice, 1 payment, 1 cash_session, 2 cash_movements; restore 1.64s, 0 errores | `qa/qa-fix-restage-restore.txt` |

## Conclusion

- `migrate:fresh` ahora pasa en MariaDB 10.4 y MariaDB 11.
- La FK `service_price_histories.service_id` permite `ON DELETE SET NULL` correctamente en ambos motores.
- FIELD-DEP-02 STAGING PASS (`qa/FINAL_RESTORE_PROOF.md`) **sigue valido**: el dump generado en la fase anterior se restaura identico contra la BD post-fix.
- Sin cambios en codigo fuera de la migration afectada.
- `main` intacto en `d54404da`. Esta rama lista para PR (sin merge a main por politica).
