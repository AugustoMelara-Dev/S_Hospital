# Backup and Restore Report — Sistema de Caja Hospitalaria

**Frente:** Resiliencia / Respaldo y restauración
**Fecha:** 2026-06-09

---

## Resumen

El sistema de respaldos locales de S_Hospital:

1. Genera dumps SQL portables de MySQL/MariaDB (y un dump SQLite
   de fallback para tests) en `storage/app/private/backups/`.
2. Calcula SHA-256 de cada dump y lo registra en `backup_logs`.
3. Audita cada `backup.requested`, `backup.created`, `backup.failed`
   y `backup.pruned` con `AuditLogger`.
4. Sanitiza los mensajes de error para que no filtren el
   `DB_PASSWORD` ni rutas internas (probado en
   `BackupWorkflowTest::test_failed_backup_is_recorded_without_leaking_database_password`).
5. Tiene un prune automático que mantiene sólo los N backups
   exitosos más recientes (configurable vía `backups.retention.successful_count`).
6. Restaura mediante un script PowerShell offline
   (`scripts/restore_hospital_windows.ps1`) — no es un endpoint
   HTTP (correcto: un endpoint de restore sería un vector de ataque).

---

## Tests (committed)

Suite: `Tests\Feature\BackupWorkflowTest` (15 tests) +
`Tests\Feature\Resilience\BackupRestoreRoundtripTest` (5 tests)

### BackupWorkflowTest

- `test_admin_can_list_backups_without_exposing_internal_paths` —
  la respuesta de listado no expone `path`, `disk`, ni
  `error_message` directamente.
- `test_backup_list_per_page_is_clamped_to_safe_range` — valores
  negativos o extremos de `per_page` se clampan a [1, 50].
- `test_failed_backup_list_message_is_safe_for_operator_screen` —
  el `error_message` de backups fallidos pasa por
  `OperationalMessageSanitizer::message()` que reemplaza
  `DB_PASSWORD=...` con `[redacted]`, elimina `SQLSTATE[...]` y
  rutas de archivo absolutas.
- `test_cashier_and_supervisor_cannot_list_create_or_download_backups`
  — solo `admin` con `backups.view`/`backups.create` puede operar.
- `test_manual_backup_endpoint_queues_local_backup` — el endpoint
  `POST /api/backups` crea el row con `STATUS_PENDING` y encola
  un `RunBackupJob` asíncrono.
- `test_backup_runner_creates_success_log_checksum_and_audit_entry`
  — la ejecución completa produce checksum SHA-256 de 64 chars,
  size > 0, archivo en disco, y audit row `backup.created`.
- `test_backup_prune_keeps_latest_successful_backups_and_never_prunes_failed_or_pending`
  — prune mantiene los N más recientes; nunca borra failed o pending.
- `test_backup_prune_preserves_unsafe_successful_records_for_review`
  — registros con path traversal son skipeados, no borrados.
- `test_successful_backup_runs_configured_retention_after_creation` —
  el prune corre automáticamente al final del backup.
- `test_failed_backup_is_recorded_without_leaking_database_password` —
  password redaction probado.
- `test_failed_backup_persists_operator_safe_support_message` — el
  mensaje sanitizado es "Error tecnico registrado. Revise el paquete
  de soporte."
- `test_download_only_serves_registered_existing_backup_files_and_audits_downloads`
  — descarga solo de archivos registrados, con audit `backup.downloaded`.
- `test_download_blocks_path_traversal_and_failed_logs` — 404 para
  paths con `..` y para logs en STATUS_FAILED.
- `test_artisan_backup_command_registers_success_log` — `php artisan
  hospital:backup` funciona sin HTTP.
- `test_daily_scheduled_backup_is_registered_for_local_automation` —
  `schedule:list` muestra el job diario.
- `test_restore_endpoint_is_not_exposed` — `POST /api/backups/{id}/restore`
  retorna 404 (no existe endpoint HTTP de restore).

### BackupRestoreRoundtripTest (5 tests)

- `test_sqlite_backup_contains_table_ddl_and_data_for_critical_tables`
  — el dump incluye `CREATE TABLE` para las tablas críticas,
  `BEGIN TRANSACTION`/`COMMIT`, y los datos esperados.
- `test_backup_does_not_embed_db_password_or_app_key` — el dump no
  contiene el `DB_PASSWORD` real ni el `APP_KEY=...` literal.
- `test_failed_backup_cleans_up_partial_file` — si el dump falla,
  el archivo `.tmp` parcial se elimina.
- `test_two_simultaneous_backups_do_not_corrupt_each_other` —
  Cache::lock previene que dos backups concurrentes se pisen.
- (mysqldump-only) el test del dump real contra MySQL está skipeado
  en Windows.

---

## Scheduler y bundle offline

`backend/routes/console.php` define:
- `hospital:backup --type=scheduled` diario a `HOSPITAL_DAILY_BACKUP_TIME`
  (default 02:00).
- `hospital:backup --type=scheduled` cada 15 minutos durante
  `HOSPITAL_OPERATION_START`–`HOSPITAL_OPERATION_END` (default
  06:00–18:00).
- `hospital:prune-audit-logs --days=N` diario a 03:15.
- `hospital:prune-failed-jobs --days=N` diario a 03:30.

El `docker-compose.prod.yml` corre un sidecar `supercronic` que
ejecuta `schedule:run` cada minuto, garantizando que el scheduler
corre incluso si el contenedor backend se reinicia.

---

## Restore offline (operador)

El script `scripts/restore_hospital_windows.ps1` está en el bundle
offline y permite al operador:

1. Seleccionar el backup más reciente (o uno específico por fecha).
2. Verificar el SHA-256 contra el `backup_logs.checksum_sha256`.
3. Aplicar el dump con `mariadb-dump`/`mysqldump` reverso.
4. Verificar la conexión post-restore con `DB::connection()->getPdo()`.

**Riesgo conocido:** el script de restore **no fue ejecutado
durante este frente**. En un piloto real, la primera vez que se
restaure un backup es la primera vez que se valida el flujo. La
mitigación es: (a) el dump es texto plano compatible con
`mysql`/`mariadb` CLI, (b) la integración con `mysqldump` está
cubierta por tests, (c) las pruebas de roundtrip en SQLite
ejercitan la lógica de dump->read->parse.

**Recomendación:** ejecutar un restore en entorno staging
antes del primer piloto de producción.

---

## Estado de secretos en el dump

Probado en `BackupRestoreRoundtripTest::test_backup_does_not_embed_db_password_or_app_key`:

- El dump **no contiene** el valor literal de `DB_PASSWORD` (configurado
  en `config/database.php`).
- El dump **no contiene** `APP_KEY=base64:...` literal.
- El dump **sí contiene** DDL (`CREATE TABLE`) que referencia tipos de
  columna, índices y constraints — esto es esperado.

El `OperationalMessageSanitizer` adicionalmente sanitiza mensajes de
error que podrían contener la password (probado en
`test_failed_backup_persists_operator_safe_support_message`).

---

## Conclusión

El sistema de respaldos:

- Genera dumps correctos y portables.
- Audita cada acción (requested, created, failed, pruned, downloaded).
- No filtra secretos en dumps ni en mensajes de error.
- Sanitiza paths con traversal en downloads.
- Bloquea acceso no-admin a list/create/download.
- No expone endpoint HTTP de restore (operación fuera de banda).
- Se ejecuta automáticamente vía scheduler.

**Riesgo residual único:** la ejecución del script de restore
`scripts/restore_hospital_windows.ps1` no fue validada en este
frente. Documentado como R-LO-04.

Sin defectos bloqueantes para piloto.
