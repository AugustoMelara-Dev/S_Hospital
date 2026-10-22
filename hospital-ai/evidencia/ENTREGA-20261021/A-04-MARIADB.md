# A-04 — Suite backend contra MariaDB de laboratorio desechable

Fecha: 2026-10-22 · Base: `sh_ai_delivery_test_20261022` (MariaDB 10.4.32 de
XAMPP, `127.0.0.1:3306`), creada como root y eliminable; no es producción ni la
base `sh_ai_lab_local`.

Comando:

```powershell
$env:APP_ENV='testing'; $env:DB_CONNECTION='mysql'; $env:DB_HOST='127.0.0.1';
$env:DB_PORT='3306'; $env:DB_DATABASE='sh_ai_delivery_test_20261022';
$env:DB_USERNAME='sh_ai_lab_local'; $env:DB_PASSWORD=$env:LAB_DB_PASSWORD
php -c <php83.ini> vendor/bin/phpunit -c phpunit.mysql.xml
```

## Resultado final (ejecución en solitario)

```
Tests: 1487, Assertions: 11212, Skipped: 69.  OK
```

**0 fallos, 0 errores.** La suite incluye `tests/Feature/Concurrent` (los tests
de concurrencia real quedan omitidos salvo que se active el flag explícito).

## Causa de los 7 errores + 18 fallos observados antes

1. **Datos de prueba con el contrato viejo (A-03)**: fixtures que ponían
   `taxable=false` por `update()`/`forceFill()` sobre servicios ya sembrados con
   `tax_rate_id`. El motor (ya con fuente única) seguía cobrando la tasa, y los
   pagos fijos de los tests quedaban por debajo del total. Corregido en
   `3d0c6677` (contrato de servicio + fixtures a `tax_rate_id=null`) y
   `0c4fb84a` (semilla/backfill).
2. **Dos suites en paralelo**: la suite SQLite y la de MariaDB comparten
   `backend/storage/framework/testing/` y `storage/app/private/backups/`. Los
   tests de `MigrationHashTest` y `BackupExternalCopyTest`/`BackupVerificationTest`
   se pisan (directorios borrados por la otra suite). Las ejecuciones finales son
   **seriales**; en solitario pasan.

## Por qué quedan 69 omitidos en MariaDB

Son omisiones **deliberadas y documentadas**, no fallos:

- **Inversas de driver**: tests que solo tienen sentido en SQLite (el camino
  MariaDB está cubierto por otro test), p. ej. DDL transaccional, triggers
  append-only, CHECKs de dominio, COMMENT de tabla, `mysqldump` vs dump SQLite.
- **Entorno Windows**: `pcntl` no existe (test de fork concurrente), DACL de
  Windows, runner golden DB que no puede `migrate:fresh`.
- **Opt-in**: medición de rendimiento (`CONSOLIDATED_PERF=1`), tests de
  concurrencia real (`HOSPITAL_RUN_CONCURRENT_TESTS=1`) y generadores de
  evidencia (variables `*_EVIDENCE_DIR`).
- **Montaje de fuente frontend** para metadata de build.

## Limitación declarada

El laboratorio es MariaDB **10.4.32**; el instalador entrega **11.4.13**. Las
migraciones usan guards por driver y la suite ya cubre ambos caminos, pero la
validación sobre 11.4 real se hace en F5 (instalación en esta PC) y F3
(servidor real del payload).
