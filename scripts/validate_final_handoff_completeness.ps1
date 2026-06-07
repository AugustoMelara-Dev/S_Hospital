param(
    [string] $ProjectRoot = "",
    [string] $HandoffPath = "qa\FINAL_PRODUCTION_HANDOFF_RESULT.md"
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-HandoffCompletenessText([string] $value) {
    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    $protected = $protected -replace "(?i)/(var|home|srv|opt|tmp|usr|mnt)/[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $failures.Add((Protect-HandoffCompletenessText $message)) | Out-Null
}

function Assert-Content([string] $pattern, [string] $message) {
    if ($content -notmatch $pattern) {
        Add-Failure $message
    }
}

function Assert-PathMention([string] $relativePath) {
    $pattern = [regex]::Escape($relativePath) -replace '\\\\', '[\\/]'
    Assert-Content $pattern "El handoff no menciona $relativePath."
}

$handoffCandidate = if ([System.IO.Path]::IsPathRooted($HandoffPath)) {
    $HandoffPath
} else {
    Join-Path $ProjectRoot $HandoffPath
}
$handoffFullPath = [System.IO.Path]::GetFullPath($handoffCandidate)
$rootPrefix = $ProjectRoot.TrimEnd("\") + "\"

if (-not $handoffFullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    Add-Failure "El handoff debe estar dentro de la carpeta instalada del sistema."
}

if (-not (Test-Path -LiteralPath $handoffFullPath -PathType Leaf)) {
    Add-Failure "No se encontro el handoff final: $handoffFullPath"
}

if ($failures.Count -eq 0) {
    $content = Get-Content -LiteralPath $handoffFullPath -Raw

    $forbiddenPatterns = @(
        @{ Pattern = ('(?i)' + 'Billing' + '\s+' + 'OS'); Message = 'Branding heredado encontrado en el handoff.' },
        @{ Pattern = '(?i)APP_KEY\s*[:=]\s*[^\s`]+'; Message = 'El handoff parece contener APP_KEY.' },
        @{ Pattern = '(?i)DB_PASSWORD\s*[:=]\s*[^\s`]+'; Message = 'El handoff parece contener DB_PASSWORD.' },
        @{ Pattern = '(?i)(TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^\s`]+'; Message = 'El handoff parece contener secretos.' },
        @{ Pattern = '(?i)[A-Z]:\\(?![\\])'; Message = 'El handoff contiene una ruta absoluta de Windows.' },
        @{ Pattern = '(?i)/(var|home|srv|opt|tmp|usr|mnt)/'; Message = 'El handoff contiene una ruta absoluta local.' }
    )

    foreach ($item in $forbiddenPatterns) {
        if ($content -match $item.Pattern) {
            Add-Failure $item.Message
        }
    }

    Assert-Content '(?m)^-\s*Decision:\s*`?PRODUCTION_CANDIDATE`?\s*$' "El handoff debe conservar decision PRODUCTION_CANDIDATE hasta cerrar evidencia fisica."
    Assert-Content '(?i)capturas|screenshots|Browser smoke' "El handoff debe mencionar capturas o browser smoke."
    Assert-Content '(?i)diagnostic|diagnostico|System diagnostics' "El handoff debe mencionar diagnostico del sistema."
    Assert-Content '(?i)Files changed in this hardening front|Files changed in this handoff front|Archivos modificados en este frente de handoff' "El handoff debe incluir archivos modificados."
    Assert-Content '(?i)Tests and gates run locally|Tests and gates to preserve|Pruebas y gates a preservar' "El handoff debe incluir pruebas y gates ejecutados o a preservar."
    Assert-Content '(?i)Remaining blockers before production handoff|Blocking items|Pendientes bloqueantes' "El handoff debe incluir pendientes fisicos/bloqueantes."
    Assert-Content '(?i)Risks and limits|Riesgos y limites' "El handoff debe incluir riesgos y limites."
    Assert-Content '(?i)Safety notes|Notas de seguridad' "El handoff debe incluir notas de seguridad."
    Assert-Content '(?i)Dependency manifest' "El handoff debe mencionar la validacion del manifest de dependencias."
    Assert-Content '(?i)Production license salt guard validation|Salida del guard de secreto de licencia de produccion' "El handoff debe conservar la salida del guard de salt de licencia."
    Assert-Content '(?i)Offline release guard self-test' "El handoff debe mencionar el self-test del guard offline."
    Assert-Content '(?i)Known limitations safety validation|Salida de validacion de limitaciones conocidas' "El handoff debe conservar la salida del guard de limitaciones conocidas."
    Assert-Content '(?i)Maintenance mode safety validation|Salida de validacion de modo mantenimiento' "El handoff debe conservar la salida del guard de modo mantenimiento."
    Assert-Content '(?i)New invoice maintainability validation|Salida de validacion de mantenibilidad de nueva factura' "El handoff debe conservar la salida del guard de mantenibilidad de nueva factura."
    Assert-Content '(?i)Handoff guard coverage validation|Salida de cobertura de guards de handoff' "El handoff debe conservar la salida del guard de cobertura handoff/offline."
    Assert-Content '(?i)Offline release staging safety validation|Salida de validacion de staging del release offline' "El handoff debe conservar la salida del guard de staging del release offline."
    Assert-Content '(?i)Backup startup current-user safety validation|Salida de validacion de arranque de respaldos por usuario' "El handoff debe conservar la salida del guard de backup startup current-user."
    Assert-Content '(?i)Windows restore safety validation|Salida de validacion de restore seguro en Windows' "El handoff debe conservar la salida del guard de restore Windows seguro."
    Assert-Content '(?i)Realtime own-event safety validation|Salida de validacion de eventos propios en tiempo real' "El handoff debe conservar la salida del guard realtime own-event."
    Assert-Content '(?i)First-level support safety validation|Salida de validacion de soporte de primer nivel' "El handoff debe conservar la salida del guard de soporte de primer nivel."
    Assert-Content '(?i)Production ready gate safety validation|Salida de validacion del gate PRODUCTION_READY' "El handoff debe conservar la salida del guard del gate PRODUCTION_READY."
    Assert-Content '(?i)Final field blockers safety self-test' "El handoff debe conservar la salida del self-test de bloqueantes fisicos finales."
    Assert-Content '(?i)Final physical proof candidate guard suite' "El handoff debe conservar la salida de los guards candidatos de evidencia fisica."
    Assert-Content '(?i)Supervised training acceptance proof|Evidencia de capacitacion supervisada|Archivo de evidencia de capacitacion supervisada' "El handoff debe conservar la prueba de aceptacion de capacitacion supervisada."
    Assert-Content '(?i)LAN loadtest safety validation|Salida de validacion de carga LAN' "El handoff debe conservar la salida del guard LAN/loadtest."
    Assert-Content 'LAN_CLIENT_PROOF:\s*YES' "El handoff debe conservar el resultado positivo del guard candidato de LAN cliente."
    Assert-Content 'INSTITUTIONAL_RECEIPT_PRINT_PROOF:\s*YES' "El handoff debe conservar el resultado positivo del guard candidato de impresion fisica."
    Assert-Content 'FINAL_STARTUP_TASK_PROOF:\s*YES' "El handoff debe conservar el resultado positivo del guard candidato de autoarranque."
    Assert-Content 'FINAL_BACKUP_TASK_PROOF:\s*YES' "El handoff debe conservar el resultado positivo del guard candidato de respaldos."
    Assert-Content 'TRAINING_ACCEPTANCE_PROOF:\s*YES' "El handoff debe conservar el resultado positivo del guard candidato de capacitacion."
    Assert-Content 'KNOWN_LIMITATIONS_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo de limitaciones conocidas."
    Assert-Content 'LAN_LOADTEST_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo del guard LAN/loadtest."
    Assert-Content 'NEW_INVOICE_MAINTAINABILITY:\s*YES' "El handoff debe conservar el resultado positivo de mantenibilidad de nueva factura."
    Assert-Content 'HANDOFF_GUARD_COVERAGE:\s*YES' "El handoff debe conservar el resultado positivo de cobertura handoff/offline."
    Assert-Content 'OFFLINE_RELEASE_STAGING_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo de staging seguro del release offline."
    Assert-Content 'BACKUP_STARTUP_CURRENT_USER_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo de backup startup current-user."
    Assert-Content 'PRODUCTION_LICENSE_SALT_GUARD:\s*YES' "El handoff debe conservar el resultado positivo del guard de salt de licencia."
    Assert-Content 'RESTORE_WINDOWS_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo de restore Windows seguro."
    Assert-Content 'REALTIME_OWN_EVENT_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo realtime own-event."
    Assert-Content 'FIRST_LEVEL_SUPPORT_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo de soporte de primer nivel."
    Assert-Content 'PRODUCTION_READY_GATE_SAFETY:\s*YES' "El handoff debe conservar el resultado positivo del gate PRODUCTION_READY."
    Assert-Content 'FINAL_FIELD_BLOCKERS_SAFETY_SELFTEST:\s*YES' "El handoff debe conservar el self-test positivo de bloqueantes fisicos finales."
    Assert-Content 'Only final-field qa/\*\.example\.md templates are allowed in offline release' "El handoff debe conservar la salida del self-test del guard offline."

    $requiredEvidence = @(
        'BROWSER_SMOKE_EVIDENCE_2026_06_03.md',
        'SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md',
        'HELP_SCREEN_SAFETY_2026_06_03.md',
        'SUPPORT_PACKET_SAFETY_2026_06_03.md',
        'FIRST_LEVEL_SUPPORT_SAFETY_2026_06_04.md',
        'BACKUP_WORKER_SMOKE_2026_06_03.md',
        'BACKUP_STARTUP_CURRENT_USER_SAFETY_2026_06_04.md',
        'FINAL_STARTUP_TASK_PROOF',
        'FINAL_BACKUP_TASK_PROOF',
        'FINAL_RESTORE_PROOF',
        'FINAL_CONCURRENCY_PROOF',
        'REALTIME_OWN_EVENT_SAFETY_2026_06_04.md',
        'STARTUP_REPAIR_SAFETY_2026_06_03.md',
        'INSTALLATION_DOCS_SAFETY_2026_06_03.md',
        'KNOWN_LIMITATIONS_SAFETY_2026_06_03.md',
        'MAINTENANCE_MODE_SAFETY_2026_06_03.md',
        'PERMISSION_AUDIT_SAFETY_2026_06_03.md',
        'RATE_LIMIT_SAFETY_2026_06_03.md',
        'OPERATOR_MANUALS_SAFETY_2026_06_03.md',
        'TRAINING_SAFETY_2026_06_03.md',
        'TRAINING_ACCEPTANCE_PROOF.example.md',
        'TRAINING_ACCEPTANCE_PROOF.md',
        'FIELD_PROOF_TEMPLATES_SAFETY_2026_06_03.md',
        'FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md',
        'PROOF_INITIALIZATION_SAFETY_2026_06_03.md',
        'OFFLINE_RELEASE_BUILDER_SELFTEST_2026_06_03.md',
        'LAN_RECOVERY_SAFETY_2026_06_03.md',
        'SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md',
        'OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md',
        'OPS_EVIDENCE_INDEX_2026_06_03.md',
        'OFFLINE_RELEASE_GUARD_2026_06_03.md',
        'NEW_INVOICE_MAINTAINABILITY_2026_06_04.md',
        'HANDOFF_GUARD_COVERAGE_2026_06_04.md',
        'OFFLINE_RELEASE_STAGING_SAFETY_2026_06_04.md',
        'OFFLINE_RELEASE_REGEN_2026_06_04.md',
        'LAN_CLIENT_PROOF_GUARD_2026_06_05.md',
        'LAN_LOADTEST_SAFETY_2026_06_04.md',
        'LAN_LOADTEST_HANDOFF_2026_06_04.md',
        'MARIADB_MIGRATION_VALIDATION_2026_06_07.md',
        'RESTORE_WINDOWS_SAFETY_2026_06_04.md',
        'PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md',
        'PRODUCTION_READY_GATE_VALIDATOR_2026_06_04.md'
    )

    foreach ($item in $requiredEvidence) {
        Assert-Content ([regex]::Escape($item)) "El handoff no menciona evidencia requerida: $item."
    }

    $requiredFiles = @(
        'frontend/src/features/help/HelpView.tsx',
        'frontend/src/features/about/AboutView.tsx',
        'frontend/src/lib/support/clientIssueLog.ts',
        'backend/app/Http/Controllers/SystemStatusController.php',
        'scripts/final_production_handoff.ps1',
        'scripts/repair_hospital_system.ps1',
        'scripts/collect_support_packet.ps1',
        'scripts/install_stack_autostart_windows.ps1',
        'scripts/install_backup_startup_current_user.ps1',
        'scripts/start_backup_automation.cmd',
        'scripts/run_backup_scheduler_loop.ps1',
        'scripts/validate_support_packet_safety.ps1',
        'scripts/validate_first_level_support_safety.ps1',
        'scripts/validate_production_ready_gate_safety.ps1',
        'scripts/validate_final_field_blockers_safety.ps1',
        'scripts/validate_browser_smoke_evidence.ps1',
        'scripts/validate_shift_incident_recovery_safety.ps1',
        'scripts/validate_lan_recovery_safety.ps1',
        'scripts/validate_lan_client_proof.ps1',
        'scripts/validate_lan_loadtest_safety.ps1',
        'scripts/validate_known_limitations_safety.ps1',
        'scripts/validate_maintenance_mode_safety.ps1',
        'scripts/validate_realtime_own_event_safety.ps1',
        'scripts/validate_permission_audit_safety.ps1',
        'scripts/validate_rate_limit_safety.ps1',
        'scripts/validate_operations_objective_audit.ps1',
        'scripts/validate_institutional_receipt_print_proof.ps1',
        'scripts/validate_new_invoice_maintainability.ps1',
        'scripts/validate_final_startup_task_proof.ps1',
        'scripts/validate_final_backup_task_proof.ps1',
        'scripts/validate_training_acceptance_proof.ps1',
        'scripts/validate_handoff_guard_coverage.ps1',
        'scripts/validate_offline_release_staging_safety.ps1',
        'scripts/validate_restore_windows_safety.ps1',
        'scripts/validate_backup_startup_current_user_safety.ps1',
        'scripts/restore_hospital_windows.ps1',
        'scripts/validate_field_proof_templates.ps1',
        'scripts/validate_proof_initialization_safety.ps1',
        'scripts/validate_dependency_manifest.ps1',
        'scripts/validate_production_license_salt_guard.ps1',
        'scripts/init_production_proofs.ps1',
        'scripts/make_offline_release.ps1',
        'scripts/assert_offline_release_clean.ps1',
        'docs/manuales'
    )

    foreach ($path in $requiredFiles) {
        Assert-PathMention $path
    }

    $requiredCommands = @(
        'pint --test',
        'phpstan analyse',
        'php artisan test',
        'npm.cmd run lint',
        'npm.cmd run typecheck',
        'npm.cmd run test',
        'npm.cmd run build',
        'check-branding.ps1',
        'smoke:real',
        'validate_known_limitations_safety.ps1',
        'validate_maintenance_mode_safety.ps1',
        'validate_institutional_receipt_print_proof.ps1',
        'validate_new_invoice_maintainability.ps1',
        'validate_final_startup_task_proof.ps1',
        'validate_final_backup_task_proof.ps1',
        'validate_training_acceptance_proof.ps1',
        'validate_lan_client_proof.ps1',
        'validate_handoff_guard_coverage.ps1',
        'validate_offline_release_staging_safety.ps1',
        'validate_lan_loadtest_safety.ps1',
        'validate_realtime_own_event_safety.ps1',
        'validate_backup_startup_current_user_safety.ps1',
        'validate_restore_windows_safety.ps1',
        'validate_first_level_support_safety.ps1',
        'validate_production_ready_gate_safety.ps1',
        'validate_final_field_blockers_safety.ps1 -SelfTest',
        'validate_dependency_manifest.ps1',
        'validate_production_license_salt_guard.ps1',
        'assert_offline_release_clean.ps1 -SelfTest',
        'install_backup_tasks_windows.ps1 -Status',
        'production_readiness_preflight.ps1'
    )

    foreach ($command in $requiredCommands) {
        Assert-Content ([regex]::Escape($command)) "El handoff no menciona gate requerido: $command."
    }

    $requiredBlockers = @(
        'LAN_CLIENT_VALIDATION_PROOF.md',
        'INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
        'TRAINING_ACCEPTANCE_PROOF.md',
        'FINAL_STARTUP_TASK_PROOF.md',
        'FINAL_BACKUP_TASK_PROOF.md',
        'Instalar o actualizar las tareas Windows',
        'Pendiente a Protegido',
        'SistemaCajaHospitalaria-StackAutostart',
        'AtStartup',
        'SistemaCajaHospitalaria-BackupWorker',
        'SistemaCajaHospitalaria-DailyBackup',
        'APP_ENV=production',
        'APP_DEBUG=false',
        'tarea continua de respaldos',
        'restore',
        'concurrency',
        'offline release'
    )

    foreach ($blocker in $requiredBlockers) {
        Assert-Content ([regex]::Escape($blocker)) "El handoff no conserva bloqueante requerido: $blocker."
    }
    Assert-Content '(?i)Backup scheduled tasks ready in status output|Tareas programadas de respaldo listas segun status' "El handoff no conserva bloqueante requerido: estado de tareas programadas de respaldo."

    $requiredSafety = @(
        @{
            Pattern = '(?i)No `?\.env`? file was deleted|No se borro ningun archivo `?\.env`?'
            Label = 'no .env deleted'
        },
        @{
            Pattern = '(?i)No database volume was reset|No se reinicio ningun volumen de base de datos'
            Label = 'no database volume reset'
        },
        @{
            Pattern = '(?i)No production data was restored over|No se sobrescribieron datos de produccion con un restore'
            Label = 'no production data overwritten by restore'
        },
        @{
            Pattern = '(?i)No push was performed|No se hizo push'
            Label = 'no push performed'
        },
        @{
            Pattern = '(?i)Secrets were not printed|No se imprimieron secretos'
            Label = 'secrets not printed'
        },
        @{
            Pattern = '(?i)Fiscal compliance was not invented|No se invento cumplimiento fiscal'
            Label = 'fiscal compliance not invented'
        }
    )

    foreach ($safety in $requiredSafety) {
        Assert-Content $safety.Pattern "El handoff no conserva nota de seguridad: $($safety.Label)."
    }
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "FINAL_HANDOFF_COMPLETENESS: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] FINAL_HANDOFF_COMPLETENESS: YES" -ForegroundColor Green
Write-Host "[OK] Handoff evidence includes captures, diagnostics, changed files, gates, physical blockers, risks and safety notes." -ForegroundColor Green
