# Golden DB runner proof - 2026-06-19

## Alcance
Validacion local no destructiva del runner rapido MySQL/MariaDB para tests backend.
El objetivo es evitar repetir migraciones en cada corrida: se calcula hash de migraciones/seeders, se materializa una base golden y cada corrida clona una base disposable `s_hospital_test_*`.

## Entorno
- Proyecto: `C:\Projects\S_Hospital`
- MariaDB temporal: `mariadb:11.4.3`
- Puerto host temporal: `127.0.0.1:3307`
- Contenedor temporal: `shospital_golden_test_mysql_goal`
- Credencial temporal: `root / test_password`
- Contenedor eliminado al finalizar: SI
- Procesos PHP colgados al finalizar: NO

## Comandos ejecutados
```powershell
docker run -d --rm --name shospital_golden_test_mysql_goal -e MARIADB_ROOT_PASSWORD=test_password -p 127.0.0.1:3307:3306 mariadb:11.4.3
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test_golden_db_runner_safety.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_backend_tests_fast_mysql.ps1 -DbHost 127.0.0.1 -DbPort 3307 -DbUsername root -DbPassword test_password -Filter AuthorizationStrategyTest -ReadyTimeoutSeconds 120
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_backend_tests_fast_mysql.ps1 -DbHost 127.0.0.1 -DbPort 3307 -DbUsername root -DbPassword test_password -Filter AuthorizationStrategyTest -ReadyTimeoutSeconds 120
docker rm -f shospital_golden_test_mysql_goal
```

## Evidencia
### Safety gate
`GOLDEN_DB_RUNNER_SAFETY: YES`

### Primera corrida real
- Migration hash: `4f4f0cd342534b5c0261237777705c75d7887a77abf16d58763b9fdb0dbfdccd`
- Golden database: `s_hospital_golden_4f4f0cd34253`
- Test database: `s_hospital_test_4f4f0cd34253_58484`
- Resultado esperado observado: `Rebuilding golden database for current migration hash.`
- PHPUnit: `OK (2 tests, 7 assertions)`
- Tiempo total del wrapper: 75.6s

### Segunda corrida real
- Migration hash: `4f4f0cd342534b5c0261237777705c75d7887a77abf16d58763b9fdb0dbfdccd`
- Golden database: `s_hospital_golden_4f4f0cd34253`
- Test database: `s_hospital_test_4f4f0cd34253_48464`
- Resultado esperado observado: `Golden database already matches migration hash.`
- PHPUnit: `OK (2 tests, 7 assertions)`
- Tiempo total del wrapper: 9.4s

## Quality gate posterior

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\quality_gate_windows.ps1 -CriticalOnly -> WINDOWS_QUALITY_GATE_PASSED despues de corregir el runner.

## Resultado
PASS. El runner real queda validado contra MariaDB temporal local: reconstruye golden solo cuando cambia el hash, clona bases disposable por corrida, marca `HOSPITAL_TEST_DB_ALREADY_MIGRATED=1` para no repetir migraciones en los tests y ejecuta PHPUnit contra `phpunit.mysql.xml`.

## Correccion aplicada durante la validacion
`scripts\run_backend_tests_fast_mysql.ps1` ahora:
- Emite progreso por pasos para diagnostico.
- Fuerza `APP_ENV=testing` antes del dry-run de hash.
- Usa timeout PDO en el constructor y `default_socket_timeout=3` para el probe.
- Captura el exit code del probe sin sombrear `$LASTEXITCODE` dentro de la funcion.

## Pendiente no relacionado
Esto no reemplaza la evidencia externa de segunda PC LAN contra `http://192.168.1.10:8081` ni la impresion fisica en papel real.

