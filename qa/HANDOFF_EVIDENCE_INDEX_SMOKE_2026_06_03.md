# Final production handoff result

- Generated at: 2026-06-03 11:52:01
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
- Browser smoke evidence guard exit code: 0
- Startup and repair safety guard exit code: 0
- Operator manuals safety guard exit code: 0
- Backup and restore docs safety guard exit code: 0
- Installation docs safety guard exit code: 0
- Help screen safety guard exit code: 0
- System diagnostics safety guard exit code: 0
- Double-action safety guard exit code: 0
- Installer legacy safety guard exit code: 0
- LAN recovery safety guard exit code: 0
- Shift incident recovery safety guard exit code: 0
- Training safety guard exit code: 0
- Final handoff completeness guard exit code: 0
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

## Evidence completed in this hardening front

- Browser smoke screenshots: `qa/browser-smoke-2026-06-03/rc-e2e-mocked-report.json` and `qa/BROWSER_SMOKE_EVIDENCE_2026_06_03.md`.
- System diagnostics and Help/support guards: `qa/SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md`, `qa/HELP_SCREEN_SAFETY_2026_06_03.md`, `qa/SUPPORT_PACKET_SAFETY_2026_06_03.md`.
- Backup worker and restore evidence: `qa/BACKUP_WORKER_SMOKE_2026_06_03.md`, `qa/FINAL_RESTORE_PROOF.md` and `qa/FINAL_RESTORE_PROOF_2026_06_03.md`.
- Concurrency and double-action evidence: `qa/FINAL_CONCURRENCY_PROOF.md` and `qa/DOUBLE_ACTION_SAFETY_2026_06_03.md`.
- Startup, installation, LAN and shift incident recovery guards: `qa/STARTUP_REPAIR_SAFETY_2026_06_03.md`, `qa/INSTALLATION_DOCS_SAFETY_2026_06_03.md`, `qa/LAN_RECOVERY_SAFETY_2026_06_03.md`, `qa/SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md`.
- Operator and training evidence: `qa/OPERATOR_MANUALS_SAFETY_2026_06_03.md` and `qa/TRAINING_SAFETY_2026_06_03.md`.
- Release and index evidence: `qa/OPS_EVIDENCE_INDEX_2026_06_03.md`, `qa/OFFLINE_RELEASE_GUARD_2026_06_03.md`.

## Tests and gates to preserve

- Backend static/format: `docker compose exec -T backend ./vendor/bin/pint --test`.
- Backend static analysis: `docker compose exec -T backend ./vendor/bin/phpstan analyse --memory-limit=1G`.
- Backend suite: `docker compose exec -T backend php artisan test`.
- Frontend gates: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test -- --run`, `npm.cmd run build`, `scripts\check-branding.ps1`.
- Browser and operational smoke: mocked E2E screenshots, `npm.cmd run smoke:real`, backup worker smoke, disposable restore, concurrency validation and `scripts\production_readiness_preflight.ps1`.

## Files changed in this handoff front

- In-app support and diagnostics: `frontend/src/features/help/HelpView.tsx`, `frontend/src/features/about/AboutView.tsx`, `frontend/src/hooks/useServerStatus.ts`, `frontend/src/lib/support/clientIssueLog.ts`, `backend/app/Http/Controllers/SystemStatusController.php`.
- Startup, installer and support scripts: `scripts/deploy_hospital_lan.ps1`, `scripts/start_hospital_services.ps1`, `scripts/open_hospital_system.ps1`, `scripts/repair_hospital_system.ps1`, `scripts/collect_support_packet.ps1`, `scripts/install_hospital_startup_shortcut.ps1`, `scripts/install_backup_tasks_windows.ps1`, `scripts/refresh_lan_ip.ps1`, `scripts/final_production_handoff.ps1`.
- Evidence guards: `scripts/validate_browser_smoke_evidence.ps1`, `scripts/validate_startup_repair_safety.ps1`, `scripts/validate_operator_manuals_safety.ps1`, `scripts/validate_backup_restore_docs_safety.ps1`, `scripts/validate_installation_docs_safety.ps1`, `scripts/validate_help_screen_safety.ps1`, `scripts/validate_system_diagnostics_safety.ps1`, `scripts/validate_double_action_safety.ps1`, `scripts/validate_installer_legacy_safety.ps1`, `scripts/validate_lan_recovery_safety.ps1`, `scripts/validate_shift_incident_recovery_safety.ps1`, `scripts/validate_training_safety.ps1`, `scripts/validate_ops_evidence_index.ps1`, `scripts/validate_final_handoff_completeness.ps1`.
- Operator material and evidence: `docs/manuales`, `docs/RELEASE_CHECKLIST.md`, QA evidence files dated 2026-06-03 and `qa/browser-smoke-2026-06-03`.

## Risks and limits

- Local Docker and mocked browser evidence do not replace final second-client LAN proof, real MariaDB/server proof or physical printer proof.
- The offline release package remains blocked until regenerated from the final commit with Docker image tar files and matching checksums.
- Final production environment must be verified with APP_ENV=production and APP_DEBUG=false before production handoff.
- Windows scheduled tasks `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup` must be installed or updated on the final server.
- Fiscal sequences/settings require administrative validation in the real environment; fiscal compliance was not invented by this report.
- Any restore or concurrency validation must use a disposable target or explicitly approved validation database, never the active production database.

## Safety notes

- No `.env` file was deleted.
- No database volume was reset.
- No production data was restored over.
- No push was performed.
- Secrets were not printed in evidence files.
- Fiscal compliance was not invented; fiscal sequences/settings still require real administrative validation before production use.

## Next commands

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://127.0.0.1:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath php
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"
# Set HOSPITAL_CONCURRENCY_LOGIN and HOSPITAL_CONCURRENCY_PASSWORD for a temporary validation account outside this report.
bash -lc "HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_BASE_URL=http://127.0.0.1:8000 HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh"
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_browser_smoke_evidence.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_startup_repair_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_operator_manuals_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_backup_restore_docs_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_installation_docs_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_help_screen_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_system_diagnostics_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_double_action_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_installer_legacy_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_recovery_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_shift_incident_recovery_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_training_safety.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_final_handoff_completeness.ps1 -HandoffPath %PROJECT_ROOT%\qa\HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md
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
[FAIL] Missing required release file: scripts\validate_browser_smoke_evidence.ps1
[FAIL] Missing required release file: scripts\validate_startup_repair_safety.ps1
[FAIL] Missing required release file: scripts\validate_operator_manuals_safety.ps1
[FAIL] Missing required release file: scripts\validate_backup_restore_docs_safety.ps1
[FAIL] Missing required release file: scripts\validate_installation_docs_safety.ps1
[FAIL] Missing required release file: scripts\validate_help_screen_safety.ps1
[FAIL] Missing required release file: scripts\validate_system_diagnostics_safety.ps1
[FAIL] Missing required release file: scripts\validate_ops_evidence_index.ps1
[FAIL] Missing required release file: scripts\validate_training_safety.ps1
[FAIL] Missing required release file: scripts\validate_double_action_safety.ps1
[FAIL] Missing required release file: scripts\validate_installer_legacy_safety.ps1
[FAIL] Missing required release file: scripts\validate_lan_recovery_safety.ps1
[FAIL] Missing required release file: scripts\validate_shift_incident_recovery_safety.ps1
[FAIL] Missing required release file: scripts\validate_final_handoff_completeness.ps1
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
[FAIL] MANIFEST.txt must reference current commit cc64ffa6 before release handoff.
[FAIL] offline-images contains no Docker image tar files.

OFFLINE_RELEASE_CLEAN: NO (30 blocking issue(s))
```

## Support packet safety validation output

```text
Paquete seguro para soporte creado en: %PROJECT_ROOT%\qa\support-packets\validation
Archivo principal: %PROJECT_ROOT%\qa\support-packets\validation\MANIFIESTO.md
[OK] SUPPORT_PACKET_SAFETY: YES
[OK] No se copiaron .env, secretos ni rutas locales reales.
```

## Browser smoke evidence validation output

```text
[ OK ] Found qa\browser-smoke-2026-06-03\rc-e2e-mocked-report.json
[ OK ] Found qa\screenshots\rc-help-support-2026-05-31\help-support-report.json
[ OK ] RC browser smoke declares mocked-e2e mode
[ OK ] RC browser smoke states it does not replace LAN/printer proof
[ OK ] RC browser smoke has no console issues
[ OK ] RC browser smoke metadata matches dashboard-light
[ OK ] RC browser smoke dashboard-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches dashboard-dark
[ OK ] RC browser smoke dashboard-dark screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches cashbox-open-light
[ OK ] RC browser smoke cashbox-open-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches billing-new-empty-light
[ OK ] RC browser smoke billing-new-empty-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches billing-new-cart-light
[ OK ] RC browser smoke billing-new-cart-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches receipt-preview-a5-light
[ OK ] RC browser smoke receipt-preview-a5-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches receipt-preview-light
[ OK ] RC browser smoke receipt-preview-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches receipt-preview-dark
[ OK ] RC browser smoke receipt-preview-dark screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches reports-admin-light
[ OK ] RC browser smoke reports-admin-light screenshot exists and is non-empty
[ OK ] RC browser smoke metadata matches backups-pending-light
[ OK ] RC browser smoke backups-pending-light screenshot exists and is non-empty
[ OK ] Help/support smoke has no console issues
[ OK ] Help/support light capture records safe support evidence without secret words
[ OK ] Help/support light screenshot exists and is non-empty
[ OK ] Help/support dark capture records safe support evidence without secret words
[ OK ] Help/support dark screenshot exists and is non-empty

BROWSER_SMOKE_EVIDENCE: YES
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

## Operator manuals safety validation output

```text
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_CAPACITACION_SEGURA.md
[ OK ] Cashier manual has daily checklist section
[ OK ] Cashier manual has delicate-action warning section
[ OK ] Cashier manual checklist has actionable checkboxes
[ OK ] Cashier manual warns before duplicate invoice/payment attempts
[ OK ] Cashier manual includes Abrir El Sistema
[ OK ] Cashier manual includes Iniciar Sesion
[ OK ] Cashier manual includes Abrir Caja
[ OK ] Cashier manual includes Crear Factura
[ OK ] Cashier manual includes Cobrar
[ OK ] Cashier manual includes Imprimir Recibo
[ OK ] Cashier manual includes Cerrar Caja
[ OK ] Cashier manual includes Si Algo Falla
[ OK ] Cashier manual blocks charging without open cashbox
[ OK ] Supervisor manual has daily checklist section
[ OK ] Supervisor manual has delicate-action warning section
[ OK ] Supervisor manual checklist has actionable checkboxes
[ OK ] Supervisor manual warns before duplicate invoice/payment attempts
[ OK ] Supervisor manual includes incident: Servidor No Disponible
[ OK ] Supervisor manual includes incident: Red Local Caida
[ OK ] Supervisor manual includes incident: Impresora No Responde
[ OK ] Supervisor manual includes incident: Caja Quedo Abierta
[ OK ] Supervisor manual includes incident: Respaldo Fallido
[ OK ] Supervisor manual includes incident: Sesion Vencida O Sin Permiso
[ OK ] Supervisor manual forbids deleting invoices
[ OK ] Administrator manual has daily checklist section
[ OK ] Administrator manual has delicate-action warning section
[ OK ] Administrator manual checklist has actionable checkboxes
[ OK ] Administrator manual warns before duplicate invoice/payment attempts
[ OK ] Administrator manual includes Usuarios Y Permisos
[ OK ] Administrator manual includes Respaldos
[ OK ] Administrator manual includes Cambios Criticos
[ OK ] Administrator manual includes Capacitacion Segura
[ OK ] Administrator manual forbids invented fiscal compliance
[ OK ] Administrator manual forbids destructive production commands
[ OK ] Operator docs include safe training/support term: base real
[ OK ] Operator docs include safe training/support term: produccion
[ OK ] Operator docs include safe training/support term: base descartable
[ OK ] Operator docs include safe training/support term: no use la base real
[ OK ] Operator docs include safe training/support term: No restaure
[ OK ] Operator docs include safe training/support term: No borre
[ OK ] Operator manuals do not expose secret-like assignments

OPERATOR_MANUALS_SAFETY: YES
```

## Backup and restore docs safety validation output

```text
[ OK ] Found docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Backup/restore guide includes Crear Respaldo Manual
[ OK ] Backup/restore guide includes Respaldos Automaticos
[ OK ] Backup/restore guide includes Retencion de respaldos
[ OK ] Backup/restore guide includes validate_backup_worker_smoke.ps1
[ OK ] Backup/restore guide includes qa\BACKUP_WORKER_SMOKE_PROOF.md
[ OK ] Backup/restore guide includes Restauracion
[ OK ] Backup/restore guide includes qa\FINAL_RESTORE_PROOF.md
[ OK ] Backup/restore guide includes validate_restore_mysql.sh
[ OK ] Backup/restore guide includes HOSPITAL_VALIDATE_RESTORE_MYSQL=1
[ OK ] Restore guide requires disposable/safe restore target
[ OK ] Restore guide forbids restoring over production for testing
[ OK ] Restore guide requires verifiable restore evidence fields
[ OK ] Restore guide explains no normal UI restore
[ OK ] Backup worker smoke avoids credentials in URL
[ OK ] Backup/support docs include safety term: No borre
[ OK ] Backup/support docs include safety term: No restaure
[ OK ] Backup/support docs include safety term: No ejecute seeders
[ OK ] Backup/support docs include safety term: no restaura backups automaticamente
[ OK ] Backup/support docs include safety term: paquete de soporte
[ OK ] Backup/support docs include safety term: No agregue archivos .env
[ OK ] Backup/restore docs do not expose secret-like assignments

BACKUP_RESTORE_DOCS_SAFETY: YES
```

## Installation docs safety validation output

```text
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Installation guide includes section: Antes De Instalar
[ OK ] Installation guide includes section: Instalar
[ OK ] Installation guide includes section: Abrir El Sistema
[ OK ] Installation guide includes section: Arranque Automatico
[ OK ] Installation guide includes section: Respaldos Automaticos
[ OK ] Installation guide includes section: Validacion Inicial
[ OK ] Installation guide includes section: Cierre Final Antes De Operar
[ OK ] Installation guide includes section: Soporte
[ OK ] Installation guide includes section: Paquete Seguro Para Soporte
[ OK ] Installation guide includes safety text: No borre carpetas de datos ni volumenes de base de datos
[ OK ] Installation guide includes safety text: no debe ofrecer una opcion de "instalacion limpia"
[ OK ] Installation guide includes safety text: migrate:fresh
[ OK ] Installation guide includes safety text: sin correr seeders de demostracion
[ OK ] Installation guide includes safety text: APP_VERSION
[ OK ] Installation guide includes safety text: http://IP-DEL-SERVIDOR:8000
[ OK ] Installation guide includes safety text: APP_URL
[ OK ] Installation guide includes safety text: install_hospital_startup_shortcut.ps1
[ OK ] Installation guide includes safety text: -WhatIfOnly
[ OK ] Installation guide includes safety text: install_backup_tasks_windows.ps1
[ OK ] Installation guide includes safety text: install_backup_startup_current_user.ps1
[ OK ] Installation guide includes safety text: BackupWorker
[ OK ] Installation guide includes safety text: DailyBackup
[ OK ] Installation guide includes safety text: Pendiente
[ OK ] Installation guide includes safety text: Protegido
[ OK ] Installation guide includes safety text: LAN_CLIENT_VALIDATION_PROOF.md
[ OK ] Installation guide includes safety text: INSTITUTIONAL_RECEIPT_PRINT_PROOF.md
[ OK ] Installation guide includes safety text: FINAL_RESTORE_PROOF.md
[ OK ] Installation guide includes safety text: FINAL_CONCURRENCY_PROOF.md
[ OK ] Installation guide includes safety text: final_production_handoff.ps1
[ OK ] Installation guide includes safety text: PRODUCTION_CANDIDATE
[ OK ] Installation guide includes safety text: validate_lan_client.ps1
[ OK ] Installation guide includes safety text: repair_hospital_system.ps1
[ OK ] Installation guide includes safety text: LOCAL_REPAIR_DIAGNOSTIC.md
[ OK ] Installation guide includes safety text: collect_support_packet.ps1
[ OK ] Installation guide includes safety text: support-packets
[ OK ] Installation guide forbids credentials in URLs
[ OK ] Installation guide keeps handoff reports inside qa
[ OK ] Installation guide keeps LAN evidence inside qa
[ OK ] Installation guide documents non-mutating dry runs
[ OK ] Installation guide documents safe repair limits
[ OK ] Installation guide protects .env files
[ OK ] Install/release docs include guardrail: PRODUCTION_READY
[ OK ] Install/release docs include guardrail: PRODUCTION_CANDIDATE
[ OK ] Install/release docs include guardrail: No ejecutar `migrate:fresh` en el servidor real
[ OK ] Install/release docs include guardrail: no restaura backups automaticamente
[ OK ] Install/release docs include guardrail: no reemplaza un archivo existente por accidente
[ OK ] Install/release docs include guardrail: no sobrescribe
[ OK ] Install/release docs include guardrail: No declare la instalacion lista para produccion
[ OK ] Install/release docs include guardrail: segunda computadora
[ OK ] Install/release docs include guardrail: impresora institucional
[ OK ] Install/release docs include guardrail: base descartable
[ OK ] Install/release docs include guardrail: concurrencia
[ OK ] Installation/support docs do not expose secret-like assignments

INSTALLATION_DOCS_SAFETY: YES
```

## Help screen safety validation output

```text
[ OK ] Found frontend\src\features\help\HelpView.tsx
[ OK ] Found frontend\src\features\help\HelpView.test.tsx
[ OK ] Found frontend\src\lib\support\clientIssueLog.ts
[ OK ] Found frontend\src\lib\support\clientIssueLog.test.ts
[ OK ] Help screen includes required section/text: Ayuda institucional
[ OK ] Help screen includes required section/text: Abrir el sistema
[ OK ] Help screen includes required section/text: Iniciar sesion
[ OK ] Help screen includes required section/text: Abrir caja
[ OK ] Help screen includes required section/text: Nueva factura
[ OK ] Help screen includes required section/text: Cobrar
[ OK ] Help screen includes required section/text: Imprimir recibo
[ OK ] Help screen includes required section/text: Reimprimir
[ OK ] Help screen includes required section/text: Reportes
[ OK ] Help screen includes required section/text: Respaldos
[ OK ] Help screen includes required section/text: Cierre de turno
[ OK ] Help screen includes required section/text: Pedir soporte
[ OK ] Help screen includes required section/text: Evidencia local para soporte
[ OK ] Help screen includes required section/text: Preparar resumen
[ OK ] Help screen includes required section/text: Ver evidencia
[ OK ] Help screen includes required section/text: Atajos de teclado
[ OK ] Help screen includes required section/text: Responsabilidades por rol
[ OK ] Help screen includes required section/text: Checklist diario por rol
[ OK ] Help screen includes required section/text: Acciones delicadas
[ OK ] Help screen includes required section/text: Capacitaci
[ OK ] Help screen includes incident guidance: Servidor no disponible
[ OK ] Help screen includes incident guidance: Impresora no responde
[ OK ] Help screen includes incident guidance: Falla la red
[ OK ] Help screen includes incident guidance: Se fue la luz
[ OK ] Help screen includes incident guidance: Caja qued
[ OK ] Help screen includes incident guidance: Diferencia de caja
[ OK ] Help screen includes incident guidance: Respaldo fallido
[ OK ] Help screen includes incident guidance: Base de datos necesita restaurarse
[ OK ] Help screen includes incident guidance: Sin permiso
[ OK ] Help screen includes incident guidance: Se cerro el navegador
[ OK ] Help screen warns not to duplicate invoices/payments
[ OK ] Help screen tells staff to check cashbox/history before retrying
[ OK ] Help screen keeps safe practice/restore database warning
[ OK ] Help support evidence explains secrets are not included
[ OK ] Help screen prepares safe support summary
[ OK ] Help screen reads local client issue evidence
[ OK ] Help screen can copy support summary when browser allows it
[ OK ] Client issue log includes safety behavior: safeClientMessage
[ OK ] Client issue log includes safety behavior: hospital_client_issue_log
[ OK ] Client issue log includes safety behavior: MAX_ISSUES = 20
[ OK ] Client issue log includes safety behavior: PERMISSION_DENIED_MESSAGE
[ OK ] Client issue log includes safety behavior: buildClientIssueSupportSummary
[ OK ] Client issue log includes safety behavior: Resumen seguro para soporte
[ OK ] Client issue log includes safety behavior: Acci
[ OK ] Client issue log includes safety behavior: no repetir facturas ni cobros
[ OK ] Client issue log includes safety behavior: [redacted]
[ OK ] Client issue log includes safety behavior: [archivo-protegido]
[ OK ] Client issue log includes safety behavior: [campo-interno]
[ OK ] Client issue log includes safety behavior: [detalle-tecnico]
[ OK ] Client issue log includes safety behavior: [ruta-local]
[ OK ] Client issue log redacts technical pattern: DB_PASSWORD
[ OK ] Client issue log redacts technical pattern: APP_KEY
[ OK ] Client issue log redacts technical pattern: SQLSTATE
[ OK ] Client issue log redacts technical pattern: \.env
[ OK ] Client issue log redacts technical pattern: storage[\\/]+logs
[ OK ] Client issue log redacts technical pattern: https?:\/\/
[ OK ] Help/support tests cover: shows operational support guidance
[ OK ] Help/support tests cover: servidor no disponible
[ OK ] Help/support tests cover: impresora no responde
[ OK ] Help/support tests cover: se fue la luz
[ OK ] Help/support tests cover: caja qued
[ OK ] Help/support tests cover: base de datos necesita restaurarse
[ OK ] Help/support tests cover: se cerro el navegador
[ OK ] Help/support tests cover: evidencia local para soporte
[ OK ] Help/support tests cover: preparar resumen
[ OK ] Help/support tests cover: redacts sensitive words
[ OK ] Help/support tests cover: removes URL credentials
[ OK ] Help/support tests cover: without secrets or local paths
[ OK ] Help screen does not expose secret-like assignments

HELP_SCREEN_SAFETY: YES
```

## System diagnostics safety validation output

```text
[ OK ] Found frontend\src\features\about\AboutView.tsx
[ OK ] Found frontend\src\features\about\AboutView.test.tsx
[ OK ] Found frontend\src\hooks\useServerStatus.ts
[ OK ] Found frontend\src\hooks\useServerStatus.test.tsx
[ OK ] Found backend\app\Http\Controllers\SystemStatusController.php
[ OK ] Found backend\tests\Feature\SystemStatusTest.php
[ OK ] Found backend\routes\api.php
[ OK ] About diagnostics include required text: Informacion del sistema
[ OK ] About diagnostics include required text: Resumen operativo
[ OK ] About diagnostics include required text: Todo bien
[ OK ] About diagnostics include required text: Error
[ OK ] About diagnostics include required text: Diagnostico administrativo
[ OK ] About diagnostics include required text: sin claves ni rutas internas
[ OK ] About diagnostics include required text: Backend
[ OK ] About diagnostics include required text: Base de datos
[ OK ] About diagnostics include required text: Interfaz web
[ OK ] About diagnostics include required text: Ultimo respaldo
[ OK ] About diagnostics include required text: Cola de trabajos
[ OK ] About diagnostics include required text: Version instalada
[ OK ] About diagnostics include required text: Red local
[ OK ] About diagnostics include required text: Migraciones
[ OK ] About diagnostics include required text: Hora del servidor
[ OK ] About diagnostics include required text: Espacio libre para respaldos
[ OK ] About diagnostics include required text: Acceso LAN
[ OK ] About diagnostics include required text: system.status.view
[ OK ] About diagnostics gate advanced details by permission
[ OK ] About diagnostics centralize admin status labels
[ OK ] About diagnostics render status levels consistently
[ OK ] About diagnostics format disk space for operators
[ OK ] Server status hook includes safe summary behavior: /api/system/health
[ OK ] Server status hook includes safe summary behavior: Todo bien
[ OK ] Server status hook includes safe summary behavior: Requiere revision
[ OK ] Server status hook includes safe summary behavior: Error
[ OK ] Server status hook includes safe summary behavior: No se pudo confirmar el servidor local
[ OK ] Server status hook includes safe summary behavior: La base de datos local no responde
[ OK ] Server status hook includes safe summary behavior: Detenga la facturacion
[ OK ] Server status hook includes safe summary behavior: Hay trabajos o respaldos con alerta
[ OK ] Server status hook includes safe summary behavior: revise respaldos
[ OK ] Server status hook includes safe summary behavior: worker_recently_active
[ OK ] Server status hook includes safe summary behavior: success_last_24h
[ OK ] Server status hook includes safe summary behavior: failed_last_24h
[ OK ] Server status hook includes safe summary behavior: storage
[ OK ] Backend system status includes safe field: environmentStatus
[ OK ] Backend system status includes safe field: databaseStatus
[ OK ] Backend system status includes safe field: frontendStatus
[ OK ] Backend system status includes safe field: networkStatus
[ OK ] Backend system status includes safe field: backupStatus
[ OK ] Backend system status includes safe field: runtimeStatus
[ OK ] Backend system status includes safe field: readinessStatus
[ OK ] Backend system status includes safe field: preflightStatus
[ OK ] Backend system status includes safe field: app_version
[ OK ] Backend system status includes safe field: server_time
[ OK ] Backend system status includes safe field: timezone
[ OK ] Backend system status includes safe field: lan_ready
[ OK ] Backend system status includes safe field: client_url
[ OK ] Backend system status includes safe field: last_success_at
[ OK ] Backend system status includes safe field: pending_backup_jobs
[ OK ] Backend system status includes safe field: failed_jobs_count
[ OK ] Backend system status includes safe field: free_bytes
[ OK ] Backend system status includes safe field: pending_migration_count
[ OK ] Backend system status includes safe field: PRODUCTION_CANDIDATE
[ OK ] Backend system status includes safe field: OperationalMessageSanitizer::url
[ OK ] Backend system status includes safe field: OperationalMessageSanitizer::message
[ OK ] Backend system status route is registered
[ OK ] Backend public health route is registered
[ OK ] Diagnostics tests cover: non-technical language
[ OK ] Diagnostics tests cover: without exposing raw technical details
[ OK ] Diagnostics tests cover: protected administrative diagnostics
[ OK ] Diagnostics tests cover: system status permission
[ OK ] Diagnostics tests cover: reads the public operational health endpoint
[ OK ] Diagnostics tests cover: cashier-safe language
[ OK ] Diagnostics tests cover: database failures
[ OK ] Diagnostics tests cover: without secret values
[ OK ] Diagnostics tests cover: sanitized scheduler heartbeat messages
[ OK ] Diagnostics tests cover: system.status.view
[ OK ] About diagnostics UI does not expose forbidden technical details
[ OK ] System status controller does not expose secret-like assignments

SYSTEM_DIAGNOSTICS_SAFETY: YES
```

## Double-action safety validation output

```text
[ OK ] Found scripts\validate_mysql_concurrency.mjs
[ OK ] Found qa\FINAL_CONCURRENCY_PROOF.md
[ OK ] Found backend\tests\Feature\InvoiceCreationTest.php
[ OK ] Found backend\tests\Feature\CashPaymentsReceiptTest.php
[ OK ] Found backend\app\Actions\Billing\CreateInvoiceAction.php
[ OK ] Found backend\app\Actions\Cash\OpenCashSessionAction.php
[ OK ] Found backend\app\Actions\Payments\RegisterPaymentAction.php
[ OK ] Found frontend\src\lib\api\base.ts
[ OK ] Found frontend\src\lib\api\base.test.ts
[ OK ] Found frontend\src\features\help\HelpView.tsx
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Concurrency validator requires explicit real-MySQL opt-in
[ OK ] Concurrency validator confirms target URL separately
[ OK ] Concurrency validator requires target environment
[ OK ] Concurrency validator rejects credentials in URLs
[ OK ] Concurrency validator refuses production-like targets
[ OK ] Concurrency validator requires disposable/local target wording
[ OK ] Concurrency evidence path is constrained
[ OK ] Concurrency evidence stays under qa
[ OK ] Concurrency validator exercises double cash opening
[ OK ] Concurrency validator exercises concurrent invoice emission
[ OK ] Concurrency validator exercises double payment
[ OK ] Concurrency validator accepts created status and conflict/validation statuses
[ OK ] Concurrency validator documents audit limitation for disposable snapshots
[ OK ] Final concurrency proof records double cash opening result
[ OK ] Final concurrency proof records concurrent invoice result
[ OK ] Final concurrency proof records double payment result
[ OK ] Final concurrency proof records duplicate-action status split
[ OK ] Final concurrency proof has a final conclusion
[ OK ] Invoice feature test covers concurrent invoice number uniqueness
[ OK ] Invoice feature test rejects duplicate invoice numbers
[ OK ] Invoice feature test checks distinct invoice numbers
[ OK ] Invoice creation uses a database transaction
[ OK ] Invoice creation locks open cash session while issuing
[ OK ] Invoice creation uses fiscal number action inside transaction
[ OK ] Cash open action checks for already-open session
[ OK ] Cash open action locks existing session check
[ OK ] Cash open action returns operator-safe duplicate cashbox message
[ OK ] Cash tests cover duplicate open request
[ OK ] Cash tests cover database uniqueness guard
[ OK ] Cash tests expect duplicate open validation
[ OK ] Payment registration locks the invoice
[ OK ] Payment registration locks the cash session
[ OK ] Payment registration rejects already paid invoices
[ OK ] Payment registration rejects overpayment
[ OK ] Payment tests reject paid invoices and overpayment
[ OK ] API maps duplicate billing operations to history guidance
[ OK ] API maps cashbox conflicts to cashbox/history guidance
[ OK ] API tests protect duplicate-operation guidance
[ OK ] API tests avoid exposing raw internal conflict fields
[ OK ] Help warns staff not to repeat invoices or payments
[ OK ] Help tells staff to check cashbox/history before retrying
[ OK ] Cashier manual warns before repeating invoice or payment
[ OK ] Supervisor manual warns before repeating invoice or payment
[ OK ] Administrator manual requires history/audit review before retrying

DOUBLE_ACTION_SAFETY: YES
```

## Installer legacy safety validation output

```text
[ OK ] Found scripts\release_setup.bat
[ OK ] Found scripts\deploy_hospital_lan.ps1
[ OK ] Found scripts\install_hospital_os.ps1
[ OK ] Found scripts\make_offline_release.ps1
[ OK ] Found scripts\assert_offline_release_clean.ps1
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\OFFLINE_LAN_INSTALL.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Found docs\OPERATIVE_NOTES_2026_06_02.md
[ OK ] setup.bat launcher delegates to supported LAN installer
[ OK ] setup.bat launcher does not invoke legacy installer
[ OK ] offline release builder uses release_setup.bat as root setup.bat
[ OK ] offline release guard requires supported LAN installer
[ OK ] offline release guard checks supported LAN installer source hash
[ OK ] supported installer uses institutional name
[ OK ] supported installer has diagnostics-only mode
[ OK ] supported installer has self-test mode
[ OK ] supported installer refuses missing backup task installer
[ OK ] supported installer runs safe migrations
[ OK ] supported installer does not run migrate:fresh
[ OK ] supported installer creates explicit role/catalog seeders only
[ OK ] legacy installer is marked deprecated at top of file
[ OK ] legacy installer points operators to supported installer
[ OK ] legacy installer explains backwards compatibility only
[ OK ] legacy installer warns at runtime
[ OK ] legacy installer says no new code paths should reference it
[ OK ] operator install guide uses setup.bat for normal install
[ OK ] operator install guide identifies supported LAN installer
[ OK ] operator install guide limits legacy installer to compatibility
[ OK ] operator install guide forbids clean destructive install
[ OK ] operator install guide forbids demo seeders
[ OK ] offline install guide prefers supported installer
[ OK ] operative notes record legacy installer deprecation
[ OK ] release checklist mentions installer legacy guard
[ OK ] Active docs/scripts do not point operators to legacy installer

INSTALLER_LEGACY_SAFETY: YES
```

## LAN recovery safety validation output

```text
[ OK ] Found scripts\refresh_lan_ip.ps1
[ OK ] Found scripts\lib\net_diagnostics.ps1
[ OK ] Found scripts\lib\env_helpers.ps1
[ OK ] Found scripts\validate_lan_client.ps1
[ OK ] Found scripts\test_validate_lan_client_safety.ps1
[ OK ] Found scripts\repair_hospital_system.ps1
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_INSTALACION_OPERATIVA.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] LAN refresh script supports PowerShell WhatIf
[ OK ] LAN refresh script imports env helper library
[ OK ] LAN refresh script imports network diagnostics library
[ OK ] LAN refresh script does not reference removed helper files
[ OK ] LAN refresh script reads existing env safely
[ OK ] LAN refresh script writes env through ASCII-safe helper
[ OK ] LAN refresh updates SERVER_IP
[ OK ] LAN refresh updates APP_URL
[ OK ] LAN refresh updates Sanctum stateful domains
[ OK ] LAN refresh updates CORS allowed origins
[ OK ] LAN refresh updates Windows firewall rule
[ OK ] LAN refresh restarts affected services
[ OK ] LAN refresh does not run destructive database commands
[ OK ] Network diagnostics use default route metrics
[ OK ] Network diagnostics identify DHCP addresses
[ OK ] Network diagnostics warn about localhost for clients
[ OK ] Network diagnostics warn about APIPA addresses
[ OK ] Env helper writes ASCII env files
[ OK ] LAN validation rejects credentials in URLs
[ OK ] LAN validation keeps evidence under qa
[ OK ] LAN validation supports WhatIfOnly
[ OK ] LAN validation safety test covers WhatIf no-write
[ OK ] LAN validation safety test rejects credential URLs
[ OK ] Repair diagnostics warn about localhost APP_URL
[ OK ] Support guide documents IP refresh preview
[ OK ] Support guide tells staff not to invoice while LAN is down
[ OK ] Install guide documents IP refresh preview
[ OK ] Install guide requires second-client validation after refresh
[ OK ] Supervisor manual warns clients not to use localhost
[ OK ] Release checklist mentions LAN recovery guard
[ OK ] LAN refresh WhatIf exits successfully against disposable fixture
[ OK ] LAN refresh WhatIf does not modify env files

LAN_RECOVERY_SAFETY: YES
```

## Shift incident recovery safety validation output

```text
[ OK ] Found frontend\src\features\help\HelpView.tsx
[ OK ] Found frontend\src\features\help\HelpView.test.tsx
[ OK ] Found frontend\src\lib\support\clientIssueLog.ts
[ OK ] Found docs\manuales\MANUAL_CAJERO.md
[ OK ] Found docs\manuales\MANUAL_SUPERVISOR.md
[ OK ] Found docs\manuales\MANUAL_ADMINISTRADOR.md
[ OK ] Found docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md
[ OK ] Found docs\manuales\GUIA_CAPACITACION_SEGURA.md
[ OK ] Found docs\RELEASE_CHECKLIST.md
[ OK ] Help and tests cover incident: Servidor no disponible
[ OK ] Help and tests cover incident: Impresora no responde
[ OK ] Help and tests cover incident: Falla la red|Red Local Caida|red local caida
[ OK ] Help and tests cover incident: Se fue la luz|reinici
[ OK ] Help and tests cover incident: Caja qued
[ OK ] Help and tests cover incident: Respaldo fallido
[ OK ] Help and tests cover incident: Base de datos necesita restaurarse
[ OK ] Help and tests cover incident: Sesion Vencida|Sesi
[ OK ] Help and tests cover incident: Sin permiso
[ OK ] Help and tests cover incident: Se cerro el navegador|Navegador cerrado
[ OK ] Help tells staff to review cashbox and history after power/browser incidents
[ OK ] Help prevents duplicate printing/payment after printer failure
[ OK ] Help directs database restore to isolated validation first
[ OK ] Help tells staff not to use another account for permissions
[ OK ] Help keeps safe support evidence workflow
[ OK ] Help support summary warns not to repeat invoices or payments
[ OK ] Cashier manual tells staff to prepare safe help summary on errors
[ OK ] Cashier manual forbids retrying uncertain invoices or payments
[ OK ] Cashier manual requires history review before repeating work
[ OK ] Supervisor manual has real-failure section
[ OK ] Supervisor manual covers browser close without duplicate work
[ OK ] Supervisor manual covers open cashbox recovery
[ OK ] Supervisor manual covers backup failure without self-restore
[ OK ] Support guide gathers operational incident facts
[ OK ] Support guide uses safe repair diagnostics
[ OK ] Support guide uses safe support packet without secrets
[ OK ] Support guide forbids destructive first-level actions
[ OK ] Support guide requires closure checks before declaring incident resolved
[ OK ] Training guide drills real incidents before production
[ OK ] Training guide forbids production practice and destructive restore
[ OK ] Administrator manual keeps restore as authorized isolated procedure
[ OK ] Release checklist mentions shift incident recovery guard
[ OK ] Incident recovery docs do not expose secret assignments
[ OK ] Help incident guidance does not expose secret assignments

SHIFT_INCIDENT_RECOVERY_SAFETY: YES
```

## Final handoff completeness validation output

```text
[OK] FINAL_HANDOFF_COMPLETENESS: YES
[OK] Handoff evidence includes captures, diagnostics, changed files, gates, physical blockers, risks and safety notes.
```

## Evidence index validation output

```text
[OK] OPS_EVIDENCE_INDEX: YES
[OK] Referencias qa/ verificadas: 21
[OK] El handoff conserva bloqueantes fisicos antes de PRODUCTION_READY.
```

## Preflight output

```text
Preflight skipped by -SkipPreflight.
```
