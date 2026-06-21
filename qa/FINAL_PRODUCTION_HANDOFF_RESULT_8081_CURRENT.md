# Final production handoff result

- Generated at: 2026-06-19 14:15:17
- Base URL: http://192.168.1.37:8081
- Project root: %PROJECT_ROOT%
- Decision: READY_FOR_REAL_LAN_INSTALLATION_TEST
- LAN client proof present without obvious placeholders: False
- Institutional receipt print proof present without obvious placeholders: False
- Final restore proof present without obvious placeholders: True
- Final concurrency proof present without obvious placeholders: True
- Final concurrency under load proof present without obvious placeholders: True
- Real LAN smoke proof present without obvious placeholders: True
- Offline release artifact guard exit code: 0
- Preflight skipped: False
- Preflight exit code: 1

## Result

Do not declare PRODUCTION_READY. Keep the system as READY_FOR_REAL_LAN_INSTALLATION_TEST only if the offline release guard is clean and the remaining blockers are field/admin-task evidence.

## Blocking items

- Missing or incomplete qa/LAN_CLIENT_VALIDATION_PROOF.md from a real second LAN client, including /api/system/echo-config and WebSocket/Soketi TCP evidence.
- Missing or incomplete qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md from the real cashier printer.
- Production preflight returned exit code 1.

## Next commands

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://192.168.1.37:8081 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -Force
# The LAN proof must include /api/system/echo-config and WebSocket/Soketi TCP connect OK from the second PC.
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Mode Docker -EnvFile [ruta-local] -ComposeProjectName shospital_offlinetest -UpdateExisting -LaunchElevated
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status
# Run frontend real smoke with E2E_REAL_* environment variables set outside this report.
cd frontend; npm.cmd run smoke:real
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"
# Set HOSPITAL_CONCURRENCY_LOGIN and HOSPITAL_CONCURRENCY_PASSWORD for a temporary validation account outside this report.
bash -lc "HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://192.168.1.37:8081 HOSPITAL_CONCURRENCY_BASE_URL=http://192.168.1.37:8081 HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh"
node scripts\validate_mysql_concurrency_under_load.mjs
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://192.168.1.37:8081 -PhpPath php
```

## Backup current-user fallback status output

```text
Automatizacion en carpeta Startup: instalada en %USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\SistemaCajaHospitalariaBackupAutomation.cmd
Contenido Startup: oculto; use paquete de soporte si se requiere revisar detalles tecnicos.
Automatizacion HKCU Run: instalada como SistemaCajaHospitalariaBackupAutomation -> "%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\SistemaCajaHospitalariaBackupAutomation.cmd"
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
[ OK ] Found scripts\install_backup_startup_current_user.ps1
[ OK ] Found scripts\start_backup_automation.cmd
[ OK ] Found scripts\run_backup_scheduler_loop.ps1
[ OK ] Found scripts\validate_support_packet_safety.ps1
[ OK ] Found scripts\validate_installer_safety.ps1
[ OK ] Found scripts\auto_evidence.ps1
[ OK ] Found scripts\quality_gate_windows.ps1
[ OK ] Found scripts\test_golden_db_runner_safety.ps1
[ OK ] Found scripts\validate_mysql_concurrency_under_load.mjs
[ OK ] Found scripts\run_backup_worker.cmd
[ OK ] Found scripts\run_scheduled_backup.cmd
[ OK ] Found docs\OFFLINE_LAN_INSTALL.md
[ OK ] Found docs\BACKUP_RESTORE.md
[ OK ] Found docs\DISASTER_RECOVERY.md
[ OK ] Found docs\PENDIENTES_VALIDACION_CAMPO.md
[ OK ] Found docs\GUIA_LAN_CLIENTE.md
[ OK ] Found docs\GUIA_IMPRESION_RECIBOS.md
[ OK ] Found docs\Manual_Usuario.md
[ OK ] Found docs\manuales\INDICE_OPERADOR.md
[ OK ] Found qa\LAN_CLIENT_VALIDATION_PROOF.example.md
[ OK ] Found qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md
[ OK ] Found qa\FINAL_RESTORE_PROOF.example.md
[ OK ] Found qa\FINAL_CONCURRENCY_PROOF.example.md
[ OK ] Found qa\FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.example.md
[ OK ] Found qa\FINAL_REAL_SMOKE_LAN_8081.example.md
[ OK ] docker-compose.prod.yml matches versioned source
[ OK ] backend\Dockerfile.prod matches versioned source
[ OK ] nginx\default.conf matches versioned source
[ OK ] scripts\collect_support_packet.ps1 matches versioned source
[ OK ] scripts\deploy_hospital_lan.ps1 matches versioned source
[ OK ] scripts\install_hospital_startup_shortcut.ps1 matches versioned source
[ OK ] scripts\install_backup_tasks_windows.ps1 matches versioned source
[ OK ] scripts\install_backup_startup_current_user.ps1 matches versioned source
[ OK ] scripts\start_backup_automation.cmd matches versioned source
[ OK ] scripts\run_backup_scheduler_loop.ps1 matches versioned source
[ OK ] scripts\lib\operational_url_safety.ps1 matches versioned source
[ OK ] scripts\open_hospital_system.ps1 matches versioned source
[ OK ] scripts\repair_hospital_system.ps1 matches versioned source
[ OK ] scripts\start_hospital_services.ps1 matches versioned source
[ OK ] scripts\validate_support_packet_safety.ps1 matches versioned source
[ OK ] scripts\validate_installer_safety.ps1 matches versioned source
[ OK ] scripts\auto_evidence.ps1 matches versioned source
[ OK ] scripts\quality_gate_windows.ps1 matches versioned source
[ OK ] scripts\test_golden_db_runner_safety.ps1 matches versioned source
[ OK ] scripts\validate_mysql_concurrency_under_load.mjs matches versioned source
[ OK ] scripts\run_backup_worker.cmd matches versioned source
[ OK ] scripts\run_scheduled_backup.cmd matches versioned source
[ OK ] scripts\init_production_proofs.ps1 matches versioned source
[ OK ] scripts\production_readiness_preflight.ps1 matches versioned source
[ OK ] scripts\test_backup_task_envfile_hardening.ps1 matches versioned source
[ OK ] qa\LAN_CLIENT_VALIDATION_PROOF.example.md matches versioned source
[ OK ] qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md matches versioned source
[ OK ] qa\FINAL_RESTORE_PROOF.example.md matches versioned source
[ OK ] qa\FINAL_CONCURRENCY_PROOF.example.md matches versioned source
[ OK ] qa\FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.example.md matches versioned source
[ OK ] qa\FINAL_REAL_SMOKE_LAN_8081.example.md matches versioned source
[ OK ] MANIFEST.txt has no stale release wording
[ OK ] MANIFEST.txt references current commit 5a076240
[ OK ] offline-images contains 6 Docker image tar file(s)

OFFLINE_RELEASE_CLEAN: YES
```

## Preflight output

```text
Production readiness preflight for http://192.168.1.37:8081
Project root: %PROJECT_ROOT%
[ OK ] Report export privacy guards cover operations API and XLSX payloads.
[ OK ] APP_ENV=production
[ OK ] APP_DEBUG=false
[ OK ] APP_URL matches BaseUrl
[WARN] SESSION_SECURE_COOKIE is not true because BaseUrl is not HTTPS. Enable it before HTTPS deployment.
[ OK ] APP_KEY is set to a non-placeholder value
[ OK ] DB_PASSWORD is set to a non-default value
[ OK ] DB_ROOT_PASSWORD is set to a non-default value
[ OK ] BaseUrl is not localhost
[ OK ] PUSHER_CLIENT_PORT matches SOKETI_PORT
[ OK ] PUSHER_CLIENT_HOST matches BaseUrl host
[ OK ] SOKETI_BIND_IP allows LAN WebSocket clients
[ OK ] DB_CONNECTION=mysql
[ OK ] SANCTUM_STATEFUL_DOMAINS includes LAN host
[ OK ] CORS origins are same-origin or include BaseUrl
[ OK ] CORS origin patterns are empty
[ OK ] QUEUE_CONNECTION=database
[ OK ] No active validation/demo users found
[ OK ] Elevated Windows backup task proof confirms SistemaCajaHospitalaria tasks are Ready as SYSTEM.
[WARN] Windows denied access while validating scheduled task 'SistemaCajaHospitalaria-BackupWorker'. Run this preflight from an elevated PowerShell window.
[WARN] Windows denied access while validating scheduled task 'SistemaCajaHospitalaria-DailyBackup'. Run this preflight from an elevated PowerShell window.
[ OK ] frontend/dist/index.html exists
[ OK ] frontend/dist/assets contains 24 files
[ OK ] php is available in PATH
[ OK ] Docker backend exposes hospital:backup command
[ OK ] Docker backend can read MariaDB migration status
[ OK ] Docker backend has mariadb-dump or mysqldump available
[ OK ] Backup worker wrapper --check passed
[ OK ] Scheduled backup wrapper --check passed
[ OK ] /up responded 200
[ OK ] /login responded 200
[ OK ] /verify-email responded 200
[FAIL] LAN client proof is marked as historical or requiring repeat; rerun scripts\validate_lan_client.ps1 from the second PC against final BaseUrl http://192.168.1.37:8081.
[FAIL] Complete a checked evidence item with a result for 'media carta' in %PROJECT_ROOT%\qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md.
[ OK ] final restore evidence is present and completed.
[ OK ] final concurrency evidence is present and completed.
[ OK ] final concurrency under load evidence is present and completed.
[ OK ] final real LAN smoke evidence is present and completed.

PRODUCTION_READY: NO (2 blocking issue(s))
```
