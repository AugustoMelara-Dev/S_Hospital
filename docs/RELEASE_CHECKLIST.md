# Release checklist - demo vendible y produccion real

Estado actual documentado: `DEMO_READY` y `PRODUCTION_CANDIDATE`. No declarar
`PRODUCTION_READY` hasta cerrar validacion fisica de cliente LAN, hardware de
impresora termica y configuracion final del servidor real.

## Quality gate seguro

- `composer validate`
- `php artisan test --colors=never`
- `vendor/bin/pint --test`
- `php artisan config:cache --no-ansi`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- `bash scripts/quality_gate.sh` si Bash esta disponible en el entorno.

El quality gate normal es no destructivo. No ejecuta `php artisan migrate:fresh --seed` contra el `.env` activo.

## Gate E2E Fase 10

Playwright queda separado del gate seguro para que los fallos de navegador no se oculten dentro del build normal:

```bash
bash scripts/e2e_gate.sh
```

Equivalente Windows:

```powershell
cd C:\Projects\S_Hospital
& "C:\Program Files\Git\usr\bin\bash.exe" scripts/e2e_gate.sh
```

El E2E local usa ambiente seguro y API mockeada para cubrir login, caja, factura, eritropoyetina normal/gratis, pago, recibo 80mm/58mm, historial, reimpresion, reportes y backup pending. No valida MySQL/MariaDB real ni hardware.

## Reset dev/testing con base descartable

`php artisan migrate:fresh --seed` solo puede usarse para validar migraciones y seeders en una base descartable de desarrollo, testing o demo. No ejecutar `migrate:fresh` en el servidor real del hospital.

Usar el script destructivo solo si se cumplen todas las condiciones:

- `APP_ENV` es `local` o `testing`.
- `HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1`.
- `DB_DATABASE` contiene `test`, `demo` o `local`, o se usa `DB_CONNECTION=sqlite` en `testing`.

```bash
HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1 bash scripts/quality_gate_destructive.sh
```

## Validacion en servidor real sin reset

En produccion offline LAN no se borra la base. La validacion segura usa:

- `.env` real de produccion creado en el servidor y fuera de Git.
- `APP_ENV=production`.
- `APP_DEBUG=false`.
- `APP_URL` con la IP fija o dominio LAN final, por ejemplo `http://192.168.1.10`.
- `SANCTUM_STATEFUL_DOMAINS` y CORS/Sanctum alineados al host LAN real y a cualquier dominio local permitido.
- Admin real creado con `php artisan auth:create-initial-admin`; no usar seeders demo.
- `composer validate`
- `php artisan test --colors=never` si el servidor tiene entorno de testing aislado.
- `php artisan config:cache --no-ansi`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- Validaciones manuales de `/up`, `/login`, `/verify-email`, caja, factura, cobro, impresion y backup sin ejecutar reset.

No ejecutar `php artisan migrate:fresh --seed` en el servidor real del hospital.

Preflight ejecutable en el servidor final:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR
```

Handoff guiado de cierre final:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR `
  -PhpPath C:\xampp\php\php.exe `
  -InitializeProofFiles
```

Este helper no aprueba produccion por si solo: crea o muestra archivos de
evidencia pendientes, muestra el estado de tareas de backup y ejecuta el
preflight sin `-AllowMissingPhysicalProof`. Si faltan `qa/LAN_CLIENT_VALIDATION_PROOF.md`
o `qa/THERMAL_PRINTER_PROOF.md` completos, el resultado correcto sigue siendo
`PRODUCTION_CANDIDATE`. Tambien deja un resumen operativo en
`qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` con la decision, bloqueantes y comandos
siguientes.

Este preflight falla si el servidor no usa `APP_ENV=production`, si `APP_DEBUG`
no es `false`, si falta `frontend/dist`, si faltan `mysql`/`mysqldump` o
`mariadb-dump`, si las rutas publicas no responden, o si no existen las pruebas
documentadas de cliente LAN e impresora fisica.

La evidencia fisica de LAN e impresora es obligatoria por defecto. El flag
`-AllowMissingPhysicalProof` solo permite una corrida parcial de entorno y deja
un warning fuerte mas salida no cero: ese resultado no puede llamarse
`PRODUCTION_READY` ni usarse como gate automatico de produccion.

## Validaciones reales antes de PRODUCTION_READY

Restore MySQL/MariaDB:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh
```

Este script es destructivo sobre `RESTORE_TEST_DATABASE`: hace `DROP DATABASE` y restaura el backup en esa base descartable. Nunca usarlo contra la base activa ni contra nombres sensibles. El nombre debe contener `test`, `restore`, `validation` o `disposable`.

Evidencia Fase 11: ejecutado en MariaDB XAMPP local contra `hospital_restore_validation_test` con backup `hospital-backup-20260517-204322-lcsexyiz.sql`, SHA256 `5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362`. Repetir en servidor final si cambia el entorno.

Concurrencia MySQL/MariaDB por HTTP contra servidor de validacion:

```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONCURRENCY_BASE_URL=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=local HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://127.0.0.1:8000 HOSPITAL_ALLOW_DEMO_VALIDATION=1 bash scripts/validate_mysql_concurrency.sh
```

Este script es mutante: abre caja, crea facturas y registra pagos con un `RUN_ID`. No borra facturas porque son registros auditables; requiere snapshot/base descartable antes de ejecutarlo.

Evidencia Fase 11: ejecutado contra `http://192.168.1.7:8000` con `HOSPITAL_CONCURRENCY_TARGET_ENV=local` y `RUN_ID=concurrency-validation-20260517T20435`; valido doble apertura de caja, doble emision de factura y doble pago. Repetir en servidor/base final descartable antes de declarar produccion.

LAN fisica:

- Desde otra computadora cliente, abrir `http://IP_DEL_SERVIDOR/login`.
- Validar `/up`, `/login` y `/verify-email`.
- Confirmar que los clientes no usan `localhost`.
- Crear factura, cobrar, ver recibo y reporte desde navegador cliente.

## Analisis estatico opcional

`phpstan` no esta instalado en el backend actual y no forma parte del gate requerido de Fase 9. Si se instala en una fase futura, el gate debe declararlo como obligatorio y fallar cuando falte.

## Seguridad y permisos

- Verificar que `auth:sanctum`, `user.active` y `password.changed` protegen rutas operativas.
- Verificar que cajero no ve ni administra backups, reportes administrativos ni configuracion fiscal.
- Verificar que admin tiene acceso a configuracion fiscal, catalogo, caja, historial, reportes y backups.
- Verificar que `must_change_password=true` solo permite `me`, cambio de password y logout.
- Verificar que usuario inactivo no puede operar aunque exista sesion.
- Confirmar que no hay secretos reales en frontend ni repositorio.

## Demo operativa

- Login local.
- Abrir caja.
- Crear factura con nombre de paciente.
- Seleccionar servicios.
- Eritropoyetina normal L.25.
- Eritropoyetina con receta de dialisis L.0.
- Cobrar factura.
- Ver recibo 80mm y 58mm.
- Reimprimir desde historial.
- Anular factura sin pagos con motivo.
- Ver reportes.
- Crear backup local.

## Offline LAN

- Confirmar que login, facturacion, pagos, reportes e impresion no dependen de internet.
- Confirmar que produccion usa MySQL/MariaDB local.
- Confirmar que frontend compilado y backend se sirven desde la PC servidor por IP LAN.
- Confirmar `APP_ENV=production`, `APP_DEBUG=false` y `php artisan config:cache` antes de entregar servidor real.
- Confirmar que no se ejecutaron seeders demo en el servidor real.
- Confirmar que `.env` production queda fuera de Git y no reemplaza secretos durante actualizaciones.
- Confirmar dominios/IP LAN explicitos para `APP_URL`, CORS y `SANCTUM_STATEFUL_DOMAINS`.
- Confirmar worker local de backups:

```powershell
php artisan queue:work --queue=backups --tries=1 --timeout=600
```

En Windows, asegurar que la tarea/servicio del worker herede la ruta de `mysqldump.exe` o `mariadb-dump.exe` en PATH. En Fase 11 el worker `--once` proceso jobs; sin dump en PATH fallo de forma controlada, y con PATH de XAMPP el backup usado para restore fue `success`.

El worker debe quedar como servicio o tarea continua, no como comando manual
temporal. Validar que un backup manual cambie de `pending` a `success`.

Helper para crear tareas Windows en el servidor final:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -WhatIfOnly
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName HospitalBillingOS-BackupWorker
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status
```

Usar `-WhatIfOnly` primero para revisar rutas. Despues de registrar las tareas,
crear un backup desde la UI y confirmar que pasa de `pending` a `success`.
Si las tareas ya existen, el script falla salvo que se use `-UpdateExisting`.
Para removerlas: `powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Uninstall`.

## Antes de produccion final

- Probar restore real en una base descartable del servidor final y guardar checksum/conteos.
- Probar desde una segunda PC en LAN usando la IP fija o dominio LAN, nunca `localhost`.
- Probar impresora fisica termica 80mm/58mm desde la PC o cliente que imprimira.
- Crear `qa/LAN_CLIENT_VALIDATION_PROOF.md` usando `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`.
- Crear `qa/THERMAL_PRINTER_PROOF.md` usando `qa/THERMAL_PRINTER_PROOF.example.md`.
- Para preparar ambos archivos sin escribir evidencia falsa:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1
```

- Desde la segunda PC cliente LAN, generar evidencia inicial de rutas:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR `
  -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

Luego completar manualmente en ese mismo archivo login, caja, factura, pago,
recibo, historial, reportes y backup `pending` -> `success`.
- Validar concurrencia real con MySQL/MariaDB.
- Crear admin inicial real con password temporal y cambio obligatorio.
- Remover o no ejecutar seeders demo fuera de `local`/`testing`.
- Ejecutar gates finales: `composer validate`, `php artisan test --colors=never`,
  `vendor/bin/pint --test`, `php artisan config:cache --no-ansi`,
  `php artisan config:clear --no-ansi`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run build`,
  `npm.cmd run e2e` y smoke visual sin issues bloqueantes.
- No ejecutar `migrate:fresh` en servidor real. Solo `php artisan migrate --force`
  con backup previo y migraciones aprobadas.
