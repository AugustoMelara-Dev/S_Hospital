# A-09 — Suite global real contra MariaDB 11.4.13 del payload

Fecha: 2026-10-26 · Rama `release/entrega-20261021` · PHP 8.3.35 del payload.

Instancia: **MariaDB 11.4.13-MariaDB** del payload
(`artifacts/native-payload/runtime/mariadb`), datadir temporal
`artifacts/mariadb-11.4-test`, escucha en `127.0.0.1:3317`. Base **desechable**
`s_hospital_test_oct26` (`utf8mb4_unicode_ci`). Producción, servicios SHospital y
la base del hospital no se tocaron.

## Invocación correcta (A-12)

Sin `HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1` **y** un `DB_DATABASE` con prefijo
`s_hospital_test_`, `tests/TestCase.php::forceTestingEnvironment` ejecuta SQLite
`:memory:` aunque se use `phpunit.mysql.xml`. La invocación real fue:

```powershell
$env:APP_ENV='testing'; $env:DB_CONNECTION='mysql'
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='3317'
$env:DB_DATABASE='s_hospital_test_oct26'; $env:DB_USERNAME='root'
$env:DB_PASSWORD=$env:LAB_MARIADB_PASSWORD
$env:HOSPITAL_TEST_ALLOW_EXTERNAL_DB='1'
$env:HOSPITAL_DUMP_BINARY='artifacts/native-payload/runtime/mariadb/bin/mariadb-dump.exe'
php -c <php83.ini> vendor/bin/phpunit -c phpunit.mysql.xml --display-skipped
```

## Resultado global final

```
Tests: 1532, Assertions: 13847, Failures: 0, Errors: 0, Skipped: 22.
Exit Code: 0
```

Misma cifra de pruebas que SQLite (1532): el descubrimiento ya incluye
`ConcurrentFiscalNumberTest` (la exclusión por prefijo lo ocultaba).

### Corrida previa y corrección (se conserva)

La primera corrida 11.4 de esta sesión dio `1532 / 13846`, **1 fallo**:
`DevelopmentValidationSeederTest` afirmaba `fiscal_settings.id = 1`; el
autoincremento del esquema desechable estaba en 93. El seeder sí reutilizaba el
singleton real; era una expectativa de prueba. Corregido en `0c7e4341`
(se afirman nombre y tamaño de papel, no la PK). Grupo focal repetido sobre
11.4: **34 pruebas, 537 aserciones, 0 fallos, 0 omisiones** (incluye
`VerifyMigrationBackupCommandTest` 13/13).

Los **9 errores** de la corrida 11.4 del 24/10 (2 singleton con PK1 en
inicializadores de laboratorio; 7 fixtures del guard de respaldo que recreaban
`users` en un esquema persistente) quedaron corregidos en `3cc98204` y
`5ed7b6fe`; no reaparecen en la corrida final.

## Concurrencia real (A-11)

`HOSPITAL_RUN_CONCURRENT_TESTS=1`, base desechable
`s_hospital_test_oct26_concurrent`:

```
Tests: 12, Assertions: 55, Failures: 0, Errors: 0, Skipped: 1.
```

- `CashSessionConcurrencyTest` (6): aperturas simultáneas, mismo usuario en dos
  cajas, cobro frente a cierre, reintento tras commit y liberación de caja.
- `FiscalNumberRaceTest` (1) y `LegacyReprintRaceTest` (1): dos procesos PHP
  separados, correlativos fiscales y contador durable de reimpresión.
- `ConcurrentFiscalNumberTest` (3 aprobadas): procesos reales sobre la misma
  base; la única omisión es el **marcador de fork `pcntl`**, no disponible en
  Windows. La verificación real se hizo con procesos PHP independientes.

## Omitidos de la corrida global (22, nombre + motivo)

1. `Tests\Unit\Support\AuditAdminTest::test_audit_admin_runs_callback_for_non_mysql_drivers_without_setting_variable` — caso SQLite; en MariaDB lo cubre `PruneCommandsTest::test_prune_command_uses_audit_admin_helper_for_real_driver`.
2. `Tests\Feature\BackupExternalCopyTest::test_external_copy_accepts_docker_container_root_on_posix_runtimes` — ruta POSIX `/external-backups` no es absoluta en Windows; los guards de destinos Windows sí se ejecutan.
3. `Tests\Feature\BackupExternalRecoveryTest::test_external_copy_recovers_synthetic_data_after_local_backup_is_lost` — el remonte sintético usa el dump SQLite; en MariaDB el writer emite `mysqldump`. Sustituido por el drill real 11.4 (16 tablas por conteo y SHA-256).
4. `Tests\Feature\BackupRecoveryMetricsTest::test_observed_lab_rto_is_measured_for_a_synthetic_recovery` — mismo caso SQLite; sustituido por el drill real.
5. `Tests\Feature\Cash\CashSessionConsolidatedPerformanceTest::test_consolidated_endpoint_query_cost_scales_with_session_count` — medición opt-in (`CONSOLIDATED_PERF=1`); no se afirma rendimiento global.
6. `Tests\Feature\InstitutionalReceiptCompactTemplateTest::test_compact_evidence_pdfs_are_written_when_output_dir_is_configured` — generador opt-in (`RECEIPT_COMPACT_EVIDENCE_DIR`); los PDF reales sí se ejecutaron en la suite.
7. `Tests\Feature\InstitutionalReceiptPortraitProfileTest::test_portrait_evidence_pdfs_are_written_when_output_dir_is_configured` — opt-in (`RECEIPT_PORTRAIT_EVIDENCE_DIR`).
8. `Tests\Feature\InstitutionalReceiptPortraitProfileTest::test_test_preview_evidence_uses_real_engine_html_when_configured` — opt-in (`RECEIPT_PREVIEW_EVIDENCE_DIR`).
9. `Tests\Feature\InvoiceHistoryReprintVoidTest::test_sqlite_driver_does_not_reproduce_the_implicit_issued_at_rewrite` — control SQLite; el defecto real solo ocurre en MariaDB y las comprobaciones de `issued_at` en MariaDB sí corren.
10. `Tests\Feature\PruneCommandsTest::test_audit_admin_helper_resets_bypass_flag_even_when_callback_throws` — caso SQLite; la contraparte real (`..._for_real_driver`) corre en MariaDB.
11. `Tests\Feature\Reconciliation\RestoreReconciliationTest::test_confirm_rejects_when_ledger_table_is_absent_and_keeps_block` — el ledger ausente se simula con DDL transaccional de SQLite; en MariaDB el DDL hace commit implícito. El 409 real sí se prueba en MariaDB.
12. `Tests\Feature\Resilience\BackupRestoreRoundtripTest::test_sqlite_backup_encrypts_table_ddl_and_data_for_critical_tables` — dump SQLite; el writer MariaDB (`mysqldump`) tiene su propio test.
13. `Tests\Feature\ConcurrentFiscalNumberTest::test_concurrent_fork_pattern_documentation_marker` — marcador `pcntl` (Windows); la concurrencia real se ejecutó con procesos PHP (12 pruebas, arriba).
14. `Tests\Coverage\CriticalModulesCoverageTest::test_critical_modules_meet_minimum_coverage` — sin `pcov`/`xdebug`; no se afirma porcentaje de cobertura.
15-20. `Tests\Feature\Concurrent\CashSessionConcurrencyTest` (6) — gated por `HOSPITAL_RUN_CONCURRENT_TESTS=1`; **ejecutadas** en la corrida de concurrencia (arriba).
21. `Tests\Feature\Concurrent\FiscalNumberRaceTest::test_two_processes_obtain_distinct_fiscal_numbers` — gated; **ejecutada** con procesos reales.
22. `Tests\Feature\Concurrent\LegacyReprintRaceTest::test_two_processes_obtain_consecutive_durable_reprint_numbers` — gated; **ejecutada** con procesos reales.

## Cobertura crítica: nada de dinero, FK, centavos o respaldo queda sin correr

- **CHECK monetarios / dominio**: `DomainConstraintsOla1Test` (8 casos) corre en MariaDB (singleton fiscal, asignación única, serie, rango fiscal, método de pago, movimiento de caja, factura pagada con caja, roundtrip).
- **Migración de centavos**: `AmountCentsMigrationTest` ejecuta las migraciones dos veces y conserva esquema/datos; no se omite.
- **FK y constraints**: las migraciones MariaDB aplican FKs y CHECKs reales; los 7 errores de fixture se corrigieron sin tocar migraciones históricas.
- **Guard de respaldo antes de migrar**: `VerifyMigrationBackupCommandTest` 13/13 en MariaDB.
- **Restauración**: drill real 11.4 con copia cifrada, pérdida simulada, descifrado e importación; 16 tablas idénticas por conteo y SHA-256 (ver `docs/qa/2026-10-24-completion.md`).
- Las únicas omisiones de respaldo son dumps **SQLite** (3, 4, 12) y una ruta **POSIX** (2); las tres primeras están sustituidas por el drill MariaDB real.

## Límites

- El drill de copia externa usa otra carpeta de la misma PC: no certifica un
  dispositivo externo ni una restauración productiva.
- No se mide cobertura instrumentada (`pcov`/`xdebug` ausentes) ni el costo
  opt-in del consolidado de caja.
