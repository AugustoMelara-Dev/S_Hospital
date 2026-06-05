# Release checklist - validacion operativa y produccion real

Estado actual documentado: `PRODUCTION_CANDIDATE`. No declarar
`PRODUCTION_READY` hasta cerrar validacion fisica de cliente LAN, hardware de
impresora institucional y configuracion final del servidor real.

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

Nota de entorno: en la shell de trabajo del 2026-05-22, `composer` no estaba
disponible en PATH, por lo que `composer validate` debe ejecutarse en una
terminal con Composer instalado antes de cerrar release.

## Gate de pulido 2026-05-22

Validado durante el pase de arquitectura/mantenibilidad/UX/metadata:

- Backend completo: `php artisan test --colors=never`.
- Backend config: `php artisan config:cache`.
- Reportes: `php artisan test --colors=never --filter=ReportMoneyArchitectureTest`.
- Reportes funcionales: `php artisan test --colors=never --filter=ReportsTest`.
- SPA/metadata: `php artisan test --colors=never --filter=ProductionSpaRouteTest`.
- Frontend unitario: `npm.cmd run test`.
- Frontend tipos: `npm.cmd run typecheck`.
- Frontend lint: `npm.cmd run lint`.
- Frontend build: `npm.cmd run build`.
- E2E mockeado: `npm.cmd run e2e`.

Estos gates no sustituyen validacion fisica de segunda PC LAN, impresora
institucional, restore final, concurrencia final ni backup worker en el servidor real.

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

Contra una instalacion ya levantada, por ejemplo Apache/Laravel en el servidor
local o una URL LAN, usar el gate Windows sin iniciar Vite:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\e2e_gate.ps1 `
  -UseExistingServer `
  -BaseUrl https://127.0.0.1
```

Cambiar `-BaseUrl` por la IP LAN real cuando se valide desde la red, por
ejemplo `https://192.168.1.10`. Este gate sigue usando los escenarios E2E
controlados de Playwright; ayuda a detectar rutas rotas, pantalla inicial,
errores de navegador y regresiones de flujo. No reemplaza las pruebas fisicas
de impresora, cliente LAN, MySQL/MariaDB real, restore o concurrencia.

El E2E local usa ambiente seguro y API mockeada para cubrir login, caja, factura, eritropoyetina normal/gratis, pago, recibo media carta/carta/A5, historial, reimpresion, reportes y backup pending. No valida MySQL/MariaDB real ni hardware.

## Reset dev/testing con base descartable

`php artisan migrate:fresh --seed` solo puede usarse para validar migraciones y seeders en una base descartable de desarrollo o testing. No ejecutar `migrate:fresh` en el servidor real del hospital.

Usar el script destructivo solo si se cumplen todas las condiciones:

- `APP_ENV` es `local` o `testing`.
- `HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1`.
- `DB_DATABASE` contiene `test` o `local`, o se usa `DB_CONNECTION=sqlite` en `testing`.

```bash
HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1 bash scripts/quality_gate_destructive.sh
```

## Validacion en servidor real sin reset

En produccion offline LAN no se borra la base. La validacion segura usa:

- `.env` real de produccion creado en el servidor y fuera de Git.
- `APP_ENV=production`.
- `APP_DEBUG=false`.
- `APP_URL` con la IP fija o dominio LAN final, por ejemplo `https://192.168.1.10`.
- `SANCTUM_STATEFUL_DOMAINS` y CORS/Sanctum alineados al host LAN real y a cualquier dominio local permitido.
- Admin real creado con el instalador o `php artisan auth:create-initial-admin` usando `HOSPITAL_INITIAL_ADMIN_PASSWORD`; no usar seeders de desarrollo ni `--password=...` en consola.
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
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 `
  -BaseUrl https://IP_DEL_SERVIDOR
```

Handoff guiado de cierre final:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 `
  -BaseUrl https://IP_DEL_SERVIDOR `
  -PhpPath C:\xampp\php\php.exe `
  -InitializeProofFiles
```

Este helper no aprueba produccion por si solo: crea o muestra archivos de
evidencia pendientes, muestra el estado de tareas de backup y ejecuta el
preflight sin `-AllowMissingPhysicalProof`. Si faltan `qa/LAN_CLIENT_VALIDATION_PROOF.md`
o `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` completos, el resultado correcto sigue siendo
`PRODUCTION_CANDIDATE`. Tambien deja un resumen operativo en
`qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` con la decision, bloqueantes y comandos
siguientes. Si usa `-ReportPath`, debe ser un archivo `.md` dentro de `qa/`;
el helper rechaza rutas fuera de la carpeta de evidencia antes de ejecutar
preflight o escribir el reporte.
El helper tambien ejecuta `scripts\validate_support_packet_safety.ps1`,
`scripts\validate_browser_smoke_evidence.ps1`,
`scripts\validate_startup_repair_safety.ps1`,
`scripts\validate_operator_manuals_safety.ps1`,
`scripts\validate_backup_restore_docs_safety.ps1`,
`scripts\validate_backup_startup_current_user_safety.ps1`,
`scripts\validate_restore_windows_safety.ps1`,
`scripts\validate_installation_docs_safety.ps1`,
`scripts\validate_help_screen_safety.ps1`,
`scripts\validate_system_diagnostics_safety.ps1`,
`scripts\validate_double_action_safety.ps1`,
`scripts\validate_installer_legacy_safety.ps1`,
`scripts\validate_lan_recovery_safety.ps1`,
`scripts\validate_lan_loadtest_safety.ps1`,
`scripts\validate_shift_incident_recovery_safety.ps1` y
`scripts\validate_training_safety.ps1`. Ejecute tambien
`scripts\validate_training_acceptance_proof.ps1 -AllowPendingFinalField` antes
del handoff candidato para confirmar que el pendiente de capacitacion conserva
sus bloqueantes y no expone secretos ni rutas locales. Para cierre final, ejecute
`scripts\validate_training_acceptance_proof.ps1` sin banderas; debe fallar hasta
que `qa\TRAINING_ACCEPTANCE_PROOF.md` este completo con evidencia anonimizada.
Ejecute tambien
`scripts\validate_operations_objective_audit.ps1` para confirmar que los
requisitos del objetivo operativo siguen trazados a evidencia local y
bloqueantes finales. Despues de escribir el reporte, ejecute
`scripts\validate_final_handoff_completeness.ps1` para confirmar que la entrega
final conserva capturas, diagnostico, archivos modificados, pruebas, pendientes
fisicos, riesgos y notas de seguridad. Despues de escribir el reporte, ejecuta
`scripts\validate_ops_evidence_index.ps1` contra ese mismo archivo y bloquea
`PRODUCTION_READY` si el paquete de soporte puede filtrar secretos, si
la evidencia visual de navegador pierde capturas criticas, consola limpia o
advertencia de que no sustituye LAN/impresora fisica, si
arranque/reparacion segura falla, si los manuales por rol pierden checklists o
advertencias, si la guia de respaldos/restauracion deja de exigir evidencia
segura, si la guia de instalacion deja de proteger instalacion conservadora,
arranque, LAN, respaldos, reparacion y cierre `PRODUCTION_CANDIDATE`, si
la pantalla de Ayuda pierde flujos criticos, incidentes reales o resumen seguro
sin secretos, si el diagnostico local pierde resumen normal, detalle avanzado
por permiso, checks de backend/base/frontend/respaldo/cola/hora/disco/LAN/version
o sanitizacion, si las defensas contra doble accion pierden cobertura, si
realtime own-event deja de invalidar datos antes de ocultar notificaciones
propias del cajero, si
el instalador legacy vuelve a aparecer como flujo soportado, si la recuperacion
por cambio de IP LAN pierde `-WhatIf`, validacion de cliente o proteccion de
evidencia, si las guias de recuperacion de incidentes de turno pierden pasos
para luz/reinicio/navegador, impresora, caja abierta, respaldo fallido,
restauracion aislada o prohibicion de repetir facturas/cobros, si capacitacion
segura falla, si el handoff final pierde archivos modificados, pruebas, riesgos
o notas de seguridad, si el indice tiene referencias
rotas, rutas locales, secretos obvios o no mantiene los bloqueantes fisicos.
El handoff tambien debe conservar `assert_offline_release_clean.ps1 -SelfTest`
y `scripts\validate_handoff_guard_coverage.ps1`, para confirmar que cada
script usado por el cierre final esta dentro del paquete offline y queda
comparado contra la fuente versionada.
Tambien debe conservar `scripts\validate_offline_release_staging_safety.ps1`
para confirmar que `make_offline_release.ps1` publica por staging y conserva el
paquete anterior si falla el guard, Docker o el swap final.
Tambien debe conservar `scripts\validate_production_license_salt_guard.ps1`
para confirmar que produccion no arranca con `HOSPITAL_LICENSE_SALT` ausente o
debil, que Docker Compose falla cerrado sin esa variable y que no se imprime ni
commitea un salt real.
Tambien debe conservar `scripts\validate_realtime_own_event_safety.ps1` para
confirmar que eventos LAN de facturas, pagos y caja siempre invalidan datos,
pero no muestran un aviso repetido al mismo usuario que ejecuto la accion.
Tambien debe conservar `scripts\validate_restore_windows_safety.ps1` para
confirmar que `scripts\restore_hospital_windows.ps1` mantiene `-SelfTest`,
solo acepta bases descartables, rechaza nombres productivos, no expone password
en consola y conserva documentacion con `qa\FINAL_RESTORE_PROOF.md`.
Antes de entregar accesos directos o scripts de recuperacion, ejecute
`scripts\validate_startup_repair_safety.ps1`; debe reportar
`STARTUP_REPAIR_SAFETY: YES` para confirmar que los flujos de arranque,
reparacion y tareas de respaldo siguen teniendo modo seguro sin borrar datos.
Antes de entregar evidencia visual o de navegador, ejecute
`scripts\validate_browser_smoke_evidence.ps1`; debe reportar
`BROWSER_SMOKE_EVIDENCE: YES` para confirmar que existen capturas de dashboard,
caja, nueva factura, recibos, reportes, respaldos y Ayuda/soporte, que la
consola no reporta errores y que la evidencia mockeada no se confunde con la
validacion fisica de LAN e impresora.
Antes de entregar manuales por rol, ejecute
`scripts\validate_operator_manuals_safety.ps1`; debe reportar
`OPERATOR_MANUALS_SAFETY: YES` para confirmar que cajero, supervisor y
administrador conservan checklist diario, advertencias y reglas de soporte.
Antes de entregar instrucciones de respaldo/restauracion, ejecute
`scripts\validate_backup_restore_docs_safety.ps1`; debe reportar
`BACKUP_RESTORE_DOCS_SAFETY: YES` para confirmar que la guia conserva
respaldo manual, worker, retencion, restore descartable y evidencia final.
Antes de usar el helper Windows de restauracion en XAMPP, ejecute
`scripts\restore_hospital_windows.ps1 -SelfTest` y despues
`scripts\validate_restore_windows_safety.ps1`; debe reportar
`RESTORE_WINDOWS_SAFETY: YES`. Use `scripts\restore_hospital_windows.ps1` solo
contra una base descartable cuyo nombre contenga `test`, `restore`,
`validation` o `disposable`; nunca contra la base activa de produccion. Al
terminar la prueba segura, complete `qa\FINAL_RESTORE_PROOF.md`.
Antes de entregar instalacion o mantenimiento, ejecute
`scripts\validate_installation_docs_safety.ps1`; debe reportar
`INSTALLATION_DOCS_SAFETY: YES` para confirmar que la guia conserva instalacion
sin borrado, URL LAN segura, accesos/arranque, tareas de respaldo,
reparacion segura, paquete de soporte y bloqueo `PRODUCTION_CANDIDATE`.
Antes de entregar la ayuda dentro del sistema, ejecute
`scripts\validate_help_screen_safety.ps1`; debe reportar
`HELP_SCREEN_SAFETY: YES` para confirmar que Ayuda conserva apertura del
sistema, login, caja, factura, cobro, impresion, cierre, respaldos, soporte,
incidentes reales, roles, advertencias y resumen seguro sin secretos.
Antes de entregar diagnostico local, ejecute
`scripts\validate_system_diagnostics_safety.ps1`; debe reportar
`SYSTEM_DIAGNOSTICS_SAFETY: YES` para confirmar que Informacion del sistema y
`/api/system/status` conservan resumen normal, detalle avanzado por permiso,
backend, base de datos, frontend, ultimo respaldo, cola, hora, disco, LAN,
version y sanitizacion.
Antes de entregar flujos de caja, factura o pagos, ejecute
`scripts\validate_double_action_safety.ps1`; debe reportar
`DOUBLE_ACTION_SAFETY: YES` para confirmar que doble click, recarga o repeticion
de acciones no pierden las defensas de caja duplicada, numeracion concurrente,
doble pago, mensajes seguros y advertencias en manuales.
Antes de entregar instalador o paquete offline, ejecute
`scripts\validate_installer_legacy_safety.ps1`; debe reportar
`INSTALLER_LEGACY_SAFETY: YES` para confirmar que `setup.bat` delega a
`scripts\deploy_hospital_lan.ps1`, que `install_hospital_os.ps1` queda solo
como compatibilidad deprecada y que el paquete offline exige el guard.
Antes de regenerar el paquete offline final, ejecute
`scripts\make_offline_release.ps1 -SelfTest`; debe reportar `SelfTest passed`
para confirmar que el layout simulado incluye `setup.bat`, nginx, scripts
operativos criticos y manuales sin tocar Docker ni `offline-release`.
Ejecute tambien `scripts\validate_dependency_manifest.ps1`; debe confirmar que
`package_manifest.json` coincide con `backend\composer.json` y
`frontend\package.json` antes de crear o entregar el paquete offline.
Antes de entregar red local, reparacion o procedimientos por cambio de IP,
ejecute `scripts\validate_lan_recovery_safety.ps1`; debe reportar
`LAN_RECOVERY_SAFETY: YES` para confirmar que `refresh_lan_ip.ps1` usa helpers
existentes, soporta `-WhatIf`, no ejecuta comandos destructivos y que soporte
de primer nivel sabe validar cliente LAN despues del refresco.
Antes de entregar guias de turno o soporte de primer nivel, ejecute
`scripts\validate_shift_incident_recovery_safety.ps1`; debe reportar
`SHIFT_INCIDENT_RECOVERY_SAFETY: YES` para confirmar que Ayuda, manuales y
soporte conservan pasos claros ante servidor caido, luz/reinicio/navegador,
impresora, red, caja abierta, respaldo fallido, sesion/permisos y restauracion
solo en base aislada, sin repetir facturas ni cobros a ciegas.
Antes de entregar material de capacitacion, ejecute
`scripts\validate_training_safety.ps1`; debe reportar `TRAINING_SAFETY: YES`
para confirmar que manuales y Ayuda siguen prohibiendo practicas sobre la base
real de produccion.
Use `qa\TRAINING_ACCEPTANCE_PROOF.example.md` para documentar la capacitacion
real sin nombres, pacientes, usuarios, contrasenas, respaldos SQL ni rutas de
equipos; deje `PRODUCTION_CANDIDATE` si faltan LAN, impresora, respaldo final o
preflight final.
Durante handoff candidato, ejecute
`scripts\validate_training_acceptance_proof.ps1 -AllowPendingFinalField` para
comprobar que el archivo pendiente mantiene bloqueantes explicitos. Antes de
pasar a `PRODUCTION_READY`, ejecute
`scripts\validate_training_acceptance_proof.ps1` sin banderas; debe reportar
`TRAINING_ACCEPTANCE_PROOF: YES` solo cuando cajero, supervisor y administrador
esten practicados en ambiente aislado y la evidencia este anonimizada.
Antes de cerrar el frente operativo, ejecute
`scripts\validate_operations_objective_audit.ps1`; debe reportar
`OPERATIONS_OBJECTIVE_AUDIT: YES` para confirmar que ayuda, diagnostico,
soporte, instalacion, recuperacion, doble accion, respaldos, capacitacion,
LAN, impresora, paquete offline y preflight final siguen trazados a evidencia
o bloqueantes de campo explicitos.
Antes de llevar plantillas al servidor final, ejecute
`scripts\validate_field_proof_templates.ps1`; debe reportar
`FIELD_PROOF_TEMPLATES: YES` para confirmar que las plantillas de cliente LAN,
impresora fisica, restore descartable y concurrencia descartable conservan los
labels y checks que exige el preflight.
Antes de ejecutar emulacion LAN o loadtest, ejecute
`scripts\validate_lan_loadtest_safety.ps1`; debe reportar
`LAN_LOADTEST_SAFETY: YES` para confirmar que los runners no tienen
contrasenas por defecto, no usan DNS publicos, no montan `docker.sock` y exigen
`HOSPITAL_LOADTEST_TARGET_ENV`, `LAN_EMULATION_RUN_ID` y confirmacion exacta de
URL antes de crear facturas de prueba. Estas pruebas son solo para base
descartable o entorno de validacion; no sustituyen
`qa\LAN_CLIENT_VALIDATION_PROOF.md`, prueba fisica de impresora ni evidencia
fiscal real.
Antes de inicializar archivos de evidencia en el servidor final, ejecute
`scripts\validate_proof_initialization_safety.ps1`; debe reportar
`PROOF_INITIALIZATION_SAFETY: YES` para confirmar que
`scripts\init_production_proofs.ps1` crea plantillas faltantes sin sobrescribir
evidencia real salvo `-Force` autorizado.
Antes de entregar el paquete final al hospital, ejecute
`scripts\validate_final_handoff_completeness.ps1`; debe reportar
`FINAL_HANDOFF_COMPLETENESS: YES` para confirmar que el reporte final conserva
capturas antes/despues o smoke visual, diagnostico de problemas, archivos
modificados, pruebas ejecutadas, pendientes fisicos, riesgos y las notas de
seguridad de no borrar `.env`, no resetear datos, no hacer push, no filtrar
secretos y no inventar cumplimiento fiscal.

Este preflight falla si la auditoria del objetivo operativo deja de trazar
ayuda, diagnostico, soporte, instalacion, recuperacion, doble accion,
respaldos, capacitacion, LAN, impresora, paquete offline y preflight final a
evidencia o bloqueantes explicitos. Tambien falla si el servidor no usa
`APP_ENV=production`, si `APP_DEBUG` no es `false`, si falta `frontend/dist`,
si faltan `mysql`/`mysqldump` o `mariadb-dump`, si las rutas publicas no
responden, o si no existen las pruebas documentadas de cliente LAN, impresora
fisica, restore final y concurrencia final.

En Windows tambien falla si no existen `SistemaCajaHospitalaria-BackupWorker` y
`SistemaCajaHospitalaria-DailyBackup`, o si el worker continuo no esta `Running`.
El handoff final tambien debe elevar esas tareas faltantes a `Blocking items`,
porque un backup manual que queda en `pending` no es aceptable para caja diaria.

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
Si genera evidencia con `HOSPITAL_RESTORE_EVIDENCE_PATH`, use solo un archivo `.md` bajo `qa/`, por ejemplo `qa/FINAL_RESTORE_PROOF.md`; el script rechaza rutas absolutas, rutas con `..` o rutas con backslashes antes de crear backup o tocar la base descartable.

Evidencia Fase 11: ejecutado en MariaDB XAMPP local contra `hospital_restore_validation_test` con backup `hospital-backup-20260517-204322-lcsexyiz.sql`, SHA256 `5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362`. Repetir en servidor final si cambia el entorno.

Concurrencia MySQL/MariaDB por HTTP contra servidor de validacion:

```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONCURRENCY_BASE_URL=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=local HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_LOGIN=usuario.validacion HOSPITAL_CONCURRENCY_PASSWORD=password-temporal bash scripts/validate_mysql_concurrency.sh
```

Este script es mutante: abre caja, crea facturas y registra pagos con un `RUN_ID`. No borra facturas porque son registros auditables; requiere snapshot/base descartable antes de ejecutarlo y credenciales temporales explicitas, nunca credenciales reales de produccion.
No ponga usuario o contrasena dentro de `HOSPITAL_CONCURRENCY_BASE_URL`; use siempre las variables de cuenta temporal. Para guardar evidencia sin editarla a mano, agregue `HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md` y luego revise que la conclusion corresponda al entorno descartable usado. Esa ruta debe ser un archivo `.md` dentro de `qa/`; el script no escribe evidencia fuera de la carpeta instalada.

Evidencia Fase 11: ejecutado contra `http://192.168.1.7:8000` con `HOSPITAL_CONCURRENCY_TARGET_ENV=local` y `RUN_ID=concurrency-validation-20260517T20435`; valido doble apertura de caja, doble emision de factura y doble pago. Repetir en servidor/base final descartable antes de declarar produccion.

Emulacion LAN/loadtest contra base descartable:

```bash
HOSPITAL_LOADTEST_TARGET_ENV=validation HOSPITAL_CONFIRM_LOADTEST_TARGET=https://192.168.1.10:8443 BASE_URL=https://192.168.1.10:8443 CASHIER_USER=validacion.caja1 CASHIER_PASSWORD=password-temporal bash scripts/loadtest_smoke.sh
```

Estos runners abren caja, crean facturas y pueden registrar pagos de prueba.
Use solo usuarios temporales y una base de validacion, descartable o training.
No usar contra la caja real de produccion. La evidencia resultante ayuda a
detectar regresiones de concurrencia y latencia, pero no reemplaza la prueba LAN
desde una segunda PC real ni la prueba de impresora fisica.
Para emulacion LAN con cinco navegadores logicos, defina tambien un
`LAN_EMULATION_RUN_ID` nuevo por corrida, por ejemplo
`lan5-YYYYMMDD-HHMM`. No reutilice el identificador: el orquestador lo compara
contra cada resultado para evitar evidencia vieja.

LAN fisica:

- Desde otra computadora cliente, abrir `https://IP_DEL_SERVIDOR/login`.
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
- Ejecutar `scripts\validate_production_license_salt_guard.ps1`.
- Generar `HOSPITAL_LICENSE_SALT` real de 32+ caracteres en el servidor final;
  no imprimirlo en evidencia, no commitearlo y no reutilizar valores de prueba.

## Validacion operativa

- Login local.
- Abrir caja.
- Crear factura con nombre de paciente.
- Seleccionar servicios.
- Eritropoyetina normal L.25.
- Eritropoyetina con receta de dialisis L.0.
- Cobrar factura.
- Ver recibo media carta, carta y A5.
- Reimprimir desde historial.
- Anular factura sin pagos con motivo.
- Ver reportes.
- Crear backup local.

## Offline LAN

- Confirmar que login, facturacion, pagos, reportes e impresion no dependen de internet.
- Confirmar que produccion usa MySQL/MariaDB local.
- Confirmar que frontend compilado y backend se sirven desde la PC servidor por IP LAN.
- Confirmar `APP_ENV=production`, `APP_DEBUG=false` y `php artisan config:cache` antes de entregar servidor real.
- Confirmar que no se ejecutaron seeders de validacion local en el servidor real.
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
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -WhatIfOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status
```

Usar `-WhatIfOnly` primero para revisar rutas. Despues de registrar las tareas,
crear un backup desde la UI y confirmar que pasa de `pending` a `success`.
Si las tareas ya existen, el script falla salvo que se use `-UpdateExisting`.
Para removerlas: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Uninstall`.

Fallback sin derechos de administrador para soporte de primer nivel:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_backup_startup_current_user_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -WhatIfOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status
```

Usar este fallback solo si no se pueden crear tareas Windows con permisos de
administrador. No reemplaza la validacion final de
`SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup`;
debe quedar registrado en el handoff si se usa Startup/HKCU Run.

## Antes de produccion final

- Probar restore real en una base descartable del servidor final y guardar checksum/conteos.
- Probar desde una segunda PC en LAN usando la IP fija o dominio LAN, nunca `localhost`.
- Probar impresora fisica media carta/carta/A5 desde la PC o cliente que imprimira.
- Crear `qa/LAN_CLIENT_VALIDATION_PROOF.md` usando `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`.
- Crear `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` usando `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md`.
- Crear `qa/FINAL_RESTORE_PROOF.md` usando `qa/FINAL_RESTORE_PROOF.example.md`.
- Crear `qa/FINAL_CONCURRENCY_PROOF.md` usando `qa/FINAL_CONCURRENCY_PROOF.example.md`.
- Para preparar ambos archivos sin escribir evidencia falsa:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1
```

- Desde la segunda PC cliente LAN, generar evidencia inicial de rutas:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 `
  -BaseUrl https://IP_DEL_SERVIDOR `
  -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

El script no sobrescribe `qa\LAN_CLIENT_VALIDATION_PROOF.md` si ya existe. Use
`-Force` solamente cuando quiera reemplazar un borrador incompleto de forma
deliberada, despues de guardar cualquier evidencia real anterior.
`-EvidencePath` debe apuntar a un archivo `.md` dentro de `qa\`; rutas fuera de
esa carpeta o sin extension Markdown fallan antes de consultar la red o escribir
evidencia.

Luego completar manualmente en ese mismo archivo login, caja, factura, pago,
recibo, historial, reportes y backup `pending` -> `success`.
- Validar concurrencia real con MySQL/MariaDB.
- Crear admin inicial real con password temporal, cambio obligatorio y contrasena entregada por entrada oculta/`HOSPITAL_INITIAL_ADMIN_PASSWORD`, no por argumento CLI.
- Remover o no ejecutar seeders de validacion local fuera de `local`/`testing`.
- Ejecutar gates finales: `composer validate`, `php artisan test --colors=never`,
  `vendor/bin/pint --test`, `php artisan config:cache --no-ansi`,
  `php artisan config:clear --no-ansi`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run build`,
  `npm.cmd run e2e` y smoke visual sin issues bloqueantes.
- No ejecutar `migrate:fresh` en servidor real. Solo `php artisan migrate --force`
  con backup previo y migraciones aprobadas.
