# Final production handoff result

- Generated at: 2026-06-03 09:23:53
- Base URL: http://127.0.0.1:8000
- Project root: %PROJECT_ROOT%
- Decision: PRODUCTION_CANDIDATE
- LAN client proof present without obvious placeholders: False
- Institutional receipt print proof present without obvious placeholders: False
- Final restore proof present without obvious placeholders: True
- Final concurrency proof present without obvious placeholders: True
- LAN client proof file: `qa/LAN_CLIENT_VALIDATION_PROOF.md`
- Institutional receipt print proof file: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
- Final restore proof file: `qa/FINAL_RESTORE_PROOF.md`
- Final concurrency proof file: `qa/FINAL_CONCURRENCY_PROOF.md`
- Offline release artifact guard exit code: 1
- Support packet safety guard exit code: 0
- Startup and repair safety guard exit code: 0
- Training safety guard exit code: 0
- Evidence index guard exit code: 0
- Preflight skipped: True
- Preflight exit code: 2

## Result

Do not declare PRODUCTION_READY. Keep the system as PRODUCTION_CANDIDATE until every blocker below is closed with real field evidence.

## Blocking items

- Missing or incomplete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a real second LAN client.
- Missing or incomplete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` from the real cashier printer.
- Preflight was skipped in this handoff run.
- Offline release artifact is missing, stale, or contains forbidden files.

## Next commands

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://127.0.0.1:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath php
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"
# Set HOSPITAL_CONCURRENCY_LOGIN and HOSPITAL_CONCURRENCY_PASSWORD for a temporary validation account outside this report.
bash -lc "HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_BASE_URL=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh"
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_startup_repair_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_training_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_ops_evidence_index.ps1 -HandoffPath %PROJECT_ROOT%\qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md
powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://127.0.0.1:8000
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://127.0.0.1:8000 -PhpPath php
```

## Backup task status output

```text
Preparando tareas programadas de respaldos para Sistema de Caja Hospitalaria.
Instalacion: %PROJECT_ROOT%
Modo: no requerido para esta accion
Worker: %PROJECT_ROOT%\scripts\run_backup_worker.cmd
Respaldo diario: %PROJECT_ROOT%\scripts\run_scheduled_backup.cmd
Tarea worker: SistemaCajaHospitalaria-BackupWorker
Tarea diaria: SistemaCajaHospitalaria-DailyBackup
SistemaCajaHospitalaria-BackupWorker: no instalada
SistemaCajaHospitalaria-DailyBackup: no instalada
Confirme que el worker esta activo y que un respaldo creado desde la UI pasa de pendiente a completado.
```

## Offline release artifact guard output

```text
Checking offline release: %PROJECT_ROOT%\offline-release
[ OK ] Found setup.bat
[ OK ] Found docker-compose.prod.yml
[ OK ] Found backend\Dockerfile.prod
[ OK ] Found nginx\default.conf
[ OK ] Found MANIFEST.txt
[ OK ] Found checksums.sha256
[ OK ] Found offline-images
[ OK ] Found scripts\deploy_hospital_lan.ps1
[ OK ] Found scripts\load_offline_images.ps1
[ OK ] Found scripts\install_hospital_startup_shortcut.ps1
[ OK ] Found scripts\install_backup_tasks_windows.ps1
[ OK ] Found scripts\validate_support_packet_safety.ps1
[FAIL] Missing required release file: scripts\validate_startup_repair_safety.ps1
[FAIL] Missing required release file: scripts\validate_ops_evidence_index.ps1
[FAIL] Missing required release file: scripts\validate_training_safety.ps1
[ OK ] Found scripts\run_backup_worker.cmd
[ OK ] Found scripts\run_scheduled_backup.cmd
[FAIL] docker-compose.prod.yml in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] backend\Dockerfile.prod in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] nginx\default.conf in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\collect_support_packet.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\deploy_hospital_lan.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\install_hospital_startup_shortcut.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\install_backup_tasks_windows.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\lib\operational_url_safety.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\open_hospital_system.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\repair_hospital_system.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\start_hospital_services.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\validate_support_packet_safety.ps1 in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\run_backup_worker.cmd in offline release differs from versioned source. Regenerate offline-release before handoff.
[FAIL] scripts\run_scheduled_backup.cmd in offline release differs from versioned source. Regenerate offline-release before handoff.
[ OK ] MANIFEST.txt has no stale release wording
[FAIL] MANIFEST.txt must reference current commit 9339c423 before release handoff.
[FAIL] offline-images contains no Docker image tar files.

OFFLINE_RELEASE_CLEAN: NO (19 blocking issue(s))
```

## Support packet safety validation output

```text
Paquete seguro para soporte creado en: %PROJECT_ROOT%\qa\support-packets\validation
Archivo principal: %PROJECT_ROOT%\qa\support-packets\validation\MANIFIESTO.md
[OK] SUPPORT_PACKET_SAFETY: YES
[OK] No se copiaron .env, secretos ni rutas locales reales.
```

## Startup and repair safety validation output

```text
[ OK ] Found scripts\start_hospital_services.ps1
[ OK ] Found scripts\repair_hospital_system.ps1
[ OK ] Found scripts\open_hospital_system.ps1
[ OK ] Found scripts\install_hospital_startup_shortcut.ps1
[ OK ] Found scripts\install_backup_tasks_windows.ps1
[ OK ] scripts\start_hospital_services.ps1 includes human safety warning
[ OK ] scripts\repair_hospital_system.ps1 includes human safety warning
[ OK ] scripts\open_hospital_system.ps1 includes human safety warning
Iniciando servicios locales del Sistema de Caja Hospitalaria...
Carpeta del sistema: %PROJECT_ROOT%
Validacion de arranque completada.
Modo Docker detectado: development-docker.
Servicios que se solicitarian: backend, frontend, mysql.
Modo WhatIf: no se levanta Docker y no se modifican contenedores.
[ OK ] Startup dry run completed in safe mode
Validacion de reparacion segura completada.
Modo WhatIf: no se levanta Docker, no se abre navegador y no se escribe diagnostico.
Ruta de diagnostico validada dentro del sistema instalado.
Modo Docker detectado: development-docker.
Servicios que se solicitarian: backend, frontend, mysql.
URL que se revisaria: http://127.0.0.1:8000.
[ OK ] Repair dry run completed in safe mode
Validacion del acceso directo completada.
Carpeta del sistema: %PROJECT_ROOT%
Destino del acceso directo: %USERPROFILE%\OneDrive\Desktop\Abrir Sistema de Caja Hospitalaria.lnk
Modo WhatIf: no se creo acceso directo ni tarea de inicio.
[ OK ] Shortcut dry run completed in safe mode
Preparando tareas programadas de respaldos para Sistema de Caja Hospitalaria.
Instalacion: %PROJECT_ROOT%
Modo: PATH del sistema
Worker: %PROJECT_ROOT%\scripts\run_backup_worker.cmd
Respaldo diario: %PROJECT_ROOT%\scripts\run_scheduled_backup.cmd
Tarea worker: SistemaCajaHospitalaria-BackupWorker
Tarea diaria: SistemaCajaHospitalaria-DailyBackup a las 23:30
Modo WhatIf: no se registraron, actualizaron ni eliminaron tareas.
Comando worker previsto: cmd.exe /c "%PROJECT_ROOT%\scripts\run_backup_worker.cmd" "[php-configurado]"
Comando respaldo diario previsto: cmd.exe /c "%PROJECT_ROOT%\scripts\run_scheduled_backup.cmd" "[php-configurado]"
Para actualizar tareas existentes use: -UpdateExisting
Para remover tareas use: -Uninstall
Para revisar estado use: -Status
[ OK ] Backup task dry run completed in safe mode

STARTUP_REPAIR_SAFETY: YES
```

## Training safety validation output

```text
[ OK ] Training docs forbid practicing in production
[ OK ] Training docs require isolated environment or disposable database
[ OK ] Training docs require cashier role practice
[ OK ] Training docs require supervisor role practice
[ OK ] Training docs require administrator role practice
[ OK ] Training docs require support summary practice
[ OK ] Training docs include scenario: servidor no disponible
[ OK ] Training docs include scenario: red local
[ OK ] Training docs include scenario: impresora no responde
[ OK ] Training docs include scenario: caja qued
[ OK ] Training docs include scenario: respaldo fallido
[ OK ] Training docs include scenario: sesion vencida
[ OK ] Training docs include scenario: error de permisos
[ OK ] Training docs include scenario: navegador
[ OK ] Training docs include scenario: energia
[ OK ] Training docs forbid real production users
[ OK ] Training docs forbid real patient data
[ OK ] Training docs forbid migrate fresh in production
[ OK ] Training docs forbid restoring over real database
[ OK ] Training docs forbid sharing secrets
[ OK ] Help screen exposes safe training section
[ OK ] Help screen exposes practice mode warning
[ OK ] Help screen warns not to use production database
[ OK ] Help screen mentions isolated practice database
[ OK ] HelpView test protects production database warning

TRAINING_SAFETY: YES
```

## Evidence index validation output

```text
[OK] OPS_EVIDENCE_INDEX: YES
[OK] Referencias qa/ verificadas: 4
[OK] El handoff conserva bloqueantes fisicos antes de PRODUCTION_READY.
```

## Preflight output

```text
Preflight skipped by -SkipPreflight.
```
