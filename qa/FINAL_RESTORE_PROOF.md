# Final restore proof

**Estado global:** PENDING_FINAL_RESTORE_VALIDATION.
**Fase:** G - prueba fisica LAN/offline real.
**Decision actual:** READY_FOR_REAL_LAN_OFFLINE_INSTALLATION_TEST, no PRODUCTION_READY.
**Estado staging local (controlado):** **FIELD-DEP-02 STAGING PASS** (MariaDB 10.4 local,
ver `## Staging PASS — 2026-06-10` abajo).

Este archivo documenta la restauracion final contra una base descartable en el
servidor final o hardware equivalente aprobado. La evidencia local historica de
Fase 11 no sustituye esta prueba si cambian servidor, rutas, Docker, dump tool,
credenciales o base de datos.

## Bloqueantes actuales (para el hospital)

- Falta seleccionar un backup `success` del servidor final / PC del hospital.
- Falta verificar SHA256 y tamano del archivo contra la MariaDB del hospital.
- Falta restaurar sobre una base descartable, nunca sobre la base activa.
- Falta capturar conteos minimos de usuarios, roles, permisos, servicios,
  facturas, pagos, cajas y `backup_logs` desde el server final.
- Falta firma del responsable del hospital y evidencia verificable bajo `qa/`.

## Comando recomendado

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 \
  RESTORE_TEST_DATABASE=hospital_restore_validation_test_disposable \
  HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test_disposable \
  scripts/validate_restore_mysql.sh
```

## Resultado operativo

Mientras este archivo siga pendiente para el hospital,
`scripts\production_readiness_preflight.ps1` debe fallar y cualquier entrega debe
quedar como `PRODUCTION_CANDIDATE`, no como `PRODUCTION_READY`.

---

## Staging PASS — 2026-06-10 (restore en MariaDB activo controlado)

**Esta seccion NO sustituye la prueba final en el hospital.** Documenta que el
mecanismo oficial de backup/restore del sistema funciona correctamente cuando
se ejecuta contra una MariaDB activa. Sera repetida en la PC del hospital con
su MariaDB 11 (definida en `docker-compose.yml`).

### Environment

- **Date/time:** 2026-06-10
- **Rama:** `qa/restore-mysql-proof`
- **HEAD probado:** `d54404da0fc722f476278ceb1edcf289f33b20ad` (== `origin/main`)
- **Responsible person:** Automated validation (qa agent)
- **Source database (active controlada):** `hospital_restore_active`
  (MariaDB 10.4.32, XAMPP, en `127.0.0.1:3306`, usuario `root`, password vacío)
- **Disposable restore database:** `hospital_restore_validation_test`
  (diferente del source; creada fresca)
- **Backup file (relative path):** `storage/app/private/backups/hospital-backup-20260610-145553-ppqwhoht.sql`
- **Backup SHA256:** `ef5f463eec15c518df6ba758074695d109e430d7c3b205c8f96fba201ca9741b`
- **Backup size bytes:** 102010
- **Engine exacto:** **MariaDB 10.4.32** (binario `mysqldump Ver 10.19 Distrib 10.4.32-MariaDB`)
- **Restore tool:** `C:\xampp\mysql\bin\mysql.exe` con `mysql ... < backup.sql`
- **Evidence files:** `qa/qa-restore-step1to5.txt`, `qa/qa-post-restore-verify.txt`,
  `qa/qa-post-restore-verify-v2.txt`, `qa/qa-backup-restore.txt`,
  `qa/qa-loss.txt`, `qa/qa-migrate-status-restored.txt`,
  `qa/qa-resilience-tests.txt`, `qa/qa-app-boot.txt`
- **Final conclusion:** **FIELD-DEP-02 STAGING PASS.** El backup oficial se
  restaura limpio en MariaDB activo; los datos criticos (usuarios, factura,
  pago, caja, RBAC, fiscal, auditoria, catalogos) quedan consistentes y la
  aplicacion arranca contra la BD restaurada.

### Comandos ejecutados (resumen)

```bash
# 0. Apuntar backend/.env a la MariaDB local controlada
#    DB_HOST=127.0.0.1, DB_USERNAME=root, DB_DATABASE=hospital_restore_active
#    (session=database)

# 1. Preparar el schema
cd backend
php artisan migrate --force            # 44 migraciones; la #45 (service_price_histories)
                                        # requiere workaround documentado abajo
# workaround MariaDB 10.4 (NO es bug del sistema; es incompatibilidad local):
# 02_06_000006 hace nullOnDelete() sobre service_id NOT NULL; MariaDB 10.4 lo
# rechaza con errno 150. Solucion in-place para staging:
php /tmp/fix_fk_workaround.php        # MODIFY service_id ... NULL; ADD CONSTRAINT;
                                        # INSERT en migrations
php artisan migrate --force            # 3 migraciones restantes (09_06)
php artisan db:seed --force            # Roles, Services, Development

# 2. Crear datos de prueba via Actions oficiales
php /tmp/seed_restore_test_v2.php      # session, invoice, payment via actions

# 3. Backup oficial
php artisan hospital:backup --type=manual
# -> hospital-backup-20260610-145553-ppqwhoht.sql
# -> SHA256: ef5f463eec15c518df6ba758074695d109e430d7c3b205c8f96fba201ca9741b
# -> size: 102010 bytes
# -> backup.requested + backup.created en audit_logs
# -> CERO secretos en el dump (verificado con grep)

# 4. Simular perdida
php /tmp/simulate_loss.php             # intento fallido (FK chain) -> drop BD completa
php /tmp/do_restore.php                # drop hospital_restore_active
                                        # create hospital_restore_validation_test
                                        # mysql < hospital-backup-...-ppqwhoht.sql

# 5. Verificar integridad post-restore
php /tmp/verify_post_restore.php       # invoice, payment, session, user, service
php /tmp/verify_post_restore_v2.php    # roles, permissions, fiscal, areas, audit
php /tmp/app_boot_smoke.php            # app boot contra BD restaurada

# 6. Sanity
php artisan migrate:status             # 47/47 migraciones Ran
./vendor/bin/phpunit --filter BackupRestoreRoundtripTest
                                        # 5/5 tests OK, 1 skipped (esperado)
```

### Datos creados (pre-loss)

| Entidad | id | detalle |
|---|---|---|
| Admin (user) | 1 | `admin.validacion`, `Administrador Validacion` |
| Supervisor (user) | 2 | `supervisor.validacion`, `Supervisor Validacion` |
| Cajero (user) | 3 | `cajero.validacion`, `Cajero Validacion` |
| Service (id 1) | 1 | `Ultrasonido`, precio 80.00 |
| Cash session | 1 | user_id=3, status=open, opening=50000.00 |
| Invoice | 1 | patient=`PACIENTE_RESTORE_TEST`, total=18400 cents, cash_session_id=1 |
| Invoice item | 1 | service_id=1, quantity=2.00, unit_price=80.00 |
| Payment | 1 | invoice_id=1, amount=18400 cents, method=cash, reference=`restore-test payment` |
| Cash movement | 1 | type=opening, amount=50000.00 |
| Cash movement | 2 | type=payment, method=cash, amount=184.00 |
| Audit logs | 73 | incluye `invoice.issued`, `payment.registered`, `cash_session.opened`, `backup.requested`, `backup.created`, `permission.attached` x66, `role.attached` x3 |
| Backup log | 1 | filename=hospital-backup-20260610-145553-ppqwhoht.sql, status=success, type=manual, sha256=ef5f46... |

### Backup generado

- **Filename:** `hospital-backup-20260610-145553-ppqwhoht.sql`
- **Path:** `backend/storage/app/private/backups/hospital-backup-20260610-145553-ppqwhoht.sql`
- **Size:** 102010 bytes
- **SHA256:** `ef5f463eec15c518df6ba758074695d109e430d7c3b205c8f96fba201ca9741b`
- **Generator:** `mysqldump Ver 10.19 Distrib 10.4.32-MariaDB, for Win64 (AMD64)`
- **Opciones aplicadas (DatabaseDumpWriter):** `--single-transaction --quick --skip-comments --result-file=...`
- **Password handling:** `MYSQL_PWD` env var (no en command line); redacted en errores via `sanitizeDumpError`
- **Secretos en el dump:** **0** (`DB_PASSWORD`, `APP_KEY`, `hospital-key`, `hospital-secret`, `REDACTED` — ninguno aparece). Solo el hash bcrypt de passwords (esperable, necesario para login).

### Perdida simulada

- **Metodo:** `DROP DATABASE hospital_restore_active` (simula perdida total de la BD activa controlada).
- **Justificacion del DROP completo (vs DELETE de filas):** la cadena de FK
  (invoice_items → invoices ← payments ← cash_movements) hace que cualquier
  intento de borrar la invoice manualmente falle con `errno 1451`, lo cual es
  buena senal de integridad referencial. La perdida total es el escenario
  realista de disaster recovery que el procedimiento oficial valida.

### Restore ejecutado

- **Procedimiento:** igual al documentado en `scripts/validate_restore_mysql.sh`
  (drop BD disposable, create, `mysql < backup.sql`, captura de conteos).
- **Comando:** `"C:\xampp\mysql\bin\mysql.exe" --host=127.0.0.1 --port=3306 --user=root hospital_restore_validation_test < "C:\...\hospital-backup-20260610-145553-ppqwhoht.sql"`
- **Tiempo de import:** 1.66 segundos
- **Output del cliente:** ninguno (import limpio)
- **Errores SQL durante el import:** 0

### Validacion post-restore

| Check | Resultado |
|---|---|
| Tablas presentes en BD restaurada | 30 (incluye `migrations`, `users`, `services`, `invoices`, `invoice_items`, `payments`, `cash_register_sessions`, `cash_movements`, `fiscal_sequences`, `fiscal_settings`, `backup_logs`, `audit_logs`, `roles`, `permissions`, `areas`, `categories`, `login_attempts`, etc.) |
| `migrations` count | **47/47 Ran** (idéntico al `migrate:status` contra la BD original) |
| `users` count | **3** (admin, supervisor, cajero) |
| `users.name` integro | `admin.validacion` y `cajero.validacion` recuperan su nombre original (cualquier modificacion posterior al backup se revierte) |
| `services` count | **122** (catalogo completo) |
| `invoices` count | **1** (PACIENTE_RESTORE_TEST, total 18400 cents) |
| `payments` count | **1** (invoice 1, 18400 cents, cash, status=posted, reference=`restore-test payment`) |
| `cash_register_sessions` count | **1** (user 3, open, opening 50000.00) |
| `cash_movements` count | **2** (opening 50000.00 + payment 184.00) |
| `invoice_items` con snapshot | 1 item, service 1, qty 2, unit_price 80.00 |
| `roles` + `permissions` | **3 roles, 33 permisos**, admin atado a `admin` role |
| `fiscal_settings` + `fiscal_sequences` | 1 row c/u |
| `areas` + `categories` | 5 c/u (Laboratorio, Radiologia, Hosp/Emerg, Odontologia, Medicamentos) |
| `audit_logs` count | **73** (incluye los 4 eventos clave del backup/pago/caja) |
| Saldo cuadra | `total_invoiced (18400) == total_paid (18400)` — cuadra exacto |
| App boot contra BD restaurada | **OK** — Laravel arranca, modelos leen, queries responden |
| `BackupRestoreRoundtripTest` (phpunit) | **5/5 OK, 1 skipped, 23 assertions** |

### Required checks (plantilla)

- [x] Disposable restore database is not the active database. Result/evidence: `hospital_restore_validation_test` != `hospital_restore_active`.
- [x] Backup file exists and has SHA256. Result/evidence: `ef5f463eec15c518df6ba758074695d109e430d7c3b205c8f96fba201ca9741b`, 102010 bytes.
- [x] Restore imports without SQL error. Result/evidence: `mysql` no emitio errores, 0 output.
- [x] Migration table has rows. Result/evidence: `migrations=47` (todas las del HEAD `d54404da`).
- [x] Services table has rows. Result/evidence: `services=122`.
- [x] Core counts captured. Result/evidence: `users=3, invoices=1, payments=1, cash_sessions=1, audit_logs=73, backup_logs=1`.

### Riesgos residuales (staging)

1. **BD restaurada no es la activa:** por diseno, este test restauro en una
   BD disposable (`hospital_restore_validation_test`). El flujo real de
   recovery consistiria en: (a) parar la app, (b) `DROP DATABASE hospital_billing`
   (c) `CREATE DATABASE hospital_billing ...`, (d) `mysql < backup.sql`,
   (e) arrancar la app. El restore **funciona**, pero el switchover
   operacional no fue probado en staging.
2. **Solo 1 backup:** staging valido 1 ciclo backup→restore. El `PruneBackupsAction`
   y la rotacion configurada en el proyecto no se ejercitaron.
3. **Scheduler de backup automatico no se probo:** el worker de Windows
   (`run_backup_worker.cmd`, `install_backup_tasks_windows.ps1`) no se
   activo en staging; solo el comando manual `php artisan hospital:backup`.

### FIELD-DEP-02-RISK-01 — bug historico en `2026_06_02_000006_change_service_price_histories_to_null_on_delete`

**Estado actual del riesgo:** corregido en el `main` integrado el 2026-06-16:
la migracion ahora ejecuta `$table->foreignId('service_id')->nullable()->change()`
antes de recrear la FK `ON DELETE SET NULL`.

**Severidad historica:** bloqueaba `php artisan migrate:fresh` y
`php artisan migrate` contra una base vacia en **cualquier** MariaDB soportada
por el proyecto (10.4 y 11.x). **No bloqueaba el ciclo backup→restore probado
en staging** (ver matiz tecnico abajo).

**Causa exacta:** la migration `database/migrations/2026_06_02_000006_change_service_price_histories_to_null_on_delete.php`
en su `up()` hace:
```php
$table->dropForeign(['service_id']);
$table->foreign('service_id')->nullOnDelete()->references('id')->on('services');
```
`nullOnDelete()` declara `ON DELETE SET NULL`, lo cual requiere que la columna
`service_id` sea `NULL`-able. Pero la columna sigue declarada `NOT NULL` (la
migration original `2026_05_31_000002_create_service_price_histories_table`
la crea con `foreignId('service_id')` que es `NOT NULL` por convencion de
Laravel). MariaDB rechaza la creacion del constraint con `errno 150` ("Foreign
key constraint is incorrectly formed") por violar la regla SQL estandar:
`ON DELETE SET NULL` requiere columna nullable.

**Confirmado en MariaDB 11.8.6 (compose prod) — 2026-06-10:**
- Contenedor: `s_hospital-mysql-1` (image `mariadb:11.8.6-MariaDB-ubu2404`)
- Conexion: `127.0.0.1:3307` con `hospital/hospital_dev` (defecto compose)
- Comando: `php artisan migrate:fresh --force` (BD `hospital_billing` vacia)
- Resultado: misma falla exacta, mismo errno 150, mismo SQL fallido.
- Evidencia: `qa/qa-mariadb11-fresh.txt`
- Conclusion: **el bug no es de version; es de la migration misma.** Cualquier
  despliegue con `migrate` desde cero fallara hasta que se arregle.

**Matiz sobre el restore probado (importante):** el staging PASS de este
documento **no se invalida** por este bug. El ciclo backup→restore usa
`mysqldump` que genera un dump completo: la columna `service_id` se crea como
`DEFAULT NULL` (visible en el `SHOW CREATE TABLE` del dump restaurado) y el
`ALTER TABLE ... ADD CONSTRAINT ... ON DELETE SET NULL` se aplica sin
problema porque la columna ya es nullable. El restore staging importo el
dump y la FK quedo activa con `ON DELETE SET NULL` correctamente (verificado
en `qa/qa-post-restore-verify-v2.txt`: tabla `service_price_histories`
presente, FK con `ON DELETE SET NULL` en el SHOW CREATE TABLE).

El bug **si bloquea** los siguientes escenarios reales:
- `php artisan migrate` contra una BD vacia en el hospital (instalacion
  inicial o recovery que arranca de schema).
- `php artisan migrate:fresh` (reset de BD).
- Cualquier `setup.sh`/`deploy_hospital_lan.ps1` que asume `migrate` limpio.

**Estado en `main @ d54404da` al momento de la prueba QA:** el codigo de la
migration estaba commiteado sin hacer nullable la columna antes del FK. La
politica de la rama `qa/restore-mysql-proof` no permitia modificar codigo
fuente, asi que se documento el hallazgo. **El bug se confirmo en MariaDB 11**
(motor declarado en `docker-compose.yml`).

**Estado en `main @ caa6a5f4` despues del merge v1.1:** el fix ya esta aplicado
en `backend/database/migrations/2026_06_02_000006_change_service_price_histories_to_null_on_delete.php`.
La evidencia final del hospital aun debe repetir `migrate`/restore en una base
descartable del entorno real.

**Workaround aplicado en staging 2026-06-10** (NO commiteado, solo
operativo en MariaDB 10.4 local):
```sql
ALTER TABLE service_price_histories MODIFY service_id BIGINT UNSIGNED NULL;
ALTER TABLE service_price_histories
  ADD CONSTRAINT service_price_histories_service_id_foreign
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
INSERT INTO migrations (migration, batch) VALUES
  ('2026_06_02_000006_change_service_price_histories_to_null_on_delete', 1);
```
Despues del workaround, las 3 migraciones restantes del 09_06 corrieron
limpias y el restore staging funciono completo.

**Fix aplicado en `main`:** la migracion hace nullable la columna ANTES de
re-crear la FK:
```php
// up()
$table->dropForeign(['service_id']);
$table->foreignId('service_id')->nullable()->change();   // <- fix
$table->foreign('service_id')->nullOnDelete()->references('id')->on('services');
```
La fix es de 1 linea, sin cambios semanticos mas alla de hacer la columna
nullable como exige la regla SQL.

**Accion pendiente antes del deploy final en el hospital:**
- Probar `php artisan migrate:fresh` contra MariaDB 11 (compose local o
  MariaDB del hospital) hasta que pase completo.
- Repetir el procedimiento de `qa/FINAL_RESTORE_PROOF.md` desde el hospital
  con la migracion corregida, sobre una BD disposable, antes de promover
  `main` a `PRODUCTION_READY`.

**Riesgo residual:** aunque el bug especifico esta corregido en el arbol actual,
la evidencia staging no sustituye un `migrate:fresh` y restore ejecutados en el
servidor final o hardware equivalente aprobado.

### Conclusion

- **Staging (este documento):** **FIELD-DEP-02 STAGING PASS.**
- **Produccion (hospital):** **PENDING_FINAL_RESTORE_VALIDATION.** Repetir
  este procedimiento contra la MariaDB 11 del hospital con la ruta de backup
  del server final, sobre una BD disposable nombrada segun la guia del
  hospital, y firmar `qa/FINAL_RESTORE_PROOF.md` con el responsable in-situ.
- **Aclaracion:** esto valida restore en entorno controlado. **NO** declara
  PRODUCTION_READY. Los otros FIELD-PILOT-DEPENDENCY (impresion fisica y LAN
  segunda PC) siguen pendientes.
