param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
        return Get-Content -LiteralPath $path -Raw
    }

    Add-Failure "No se encontro $relativePath."
    return ""
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Test-NotContains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

function Test-NoProfilePowerShellCommands([string] $content, [string] $label) {
    if ($content -match 'powershell(?:\.exe)?\s+-ExecutionPolicy') {
        Add-Failure "$label uses PowerShell without -NoProfile."
    } else {
        Add-Pass "$label uses -NoProfile in documented PowerShell commands"
    }
}

$installGuide = Read-RequiredFile "docs\manuales\GUIA_INSTALACION_OPERATIVA.md"
$supportGuide = Read-RequiredFile "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md"
$backupGuide = Read-RequiredFile "docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md"
$offlineLanInstallGuide = Read-RequiredFile "docs\OFFLINE_LAN_INSTALL.md"
$backupRestoreReference = Read-RequiredFile "docs\BACKUP_RESTORE.md"
$dailyCloseProtocol = Read-RequiredFile "docs\DAILY_CLOSE_PROTOCOL.md"
$disasterRecoveryGuide = Read-RequiredFile "docs\DISASTER_RECOVERY.md"
$implementationPlan = Read-RequiredFile "docs\IMPLEMENTATION_PLAN.md"
$troubleshootingGuide = Read-RequiredFile "docs\TROUBLESHOOTING.md"
$docsIndex = Read-RequiredFile "docs\00_README.md"
$posBillingUxSpec = Read-RequiredFile "docs\03_POS_BILLING_UX_SPEC.md"
$serviceScanWorkflow = Read-RequiredFile "docs\06_SERVICE_SCAN_WORKFLOW.md"
$finalPhasesRoadmap = Read-RequiredFile "docs\07_FINAL_PHASES_ROADMAP.md"
$finalExecutionPackIndex = Read-RequiredFile "docs\09_FINAL_EXECUTION_PACK_INDEX.md"
$correctedFinalProductPlan = Read-RequiredFile "docs\12_CORRECTED_FINAL_PRODUCT_PLAN.md"
$trainingAdminGuide = Read-RequiredFile "docs\TRAINING_ADMIN.md"
$userManual = Read-RequiredFile "docs\Manual_Usuario.md"
$userManualHtml = Read-RequiredFile "docs\Manual_Usuario.html"
$operatorIndex = Read-RequiredFile "docs\manuales\INDICE_OPERADOR.md"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"
$finalProductionHandoffScript = Read-RequiredFile "scripts\final_production_handoff.ps1"
$installSummary = Read-RequiredFile "docs\INSTALL_SUMMARY.md"
$fieldDeploymentValidation = Read-RequiredFile "qa\FIELD_DEPLOYMENT_VALIDATION.md"
$releaseReadiness = Read-RequiredFile "qa\RELEASE_READINESS.md"
$productionGapReport = Read-RequiredFile "qa\PRODUCTION_READINESS_GAP_REPORT.md"
$validationPresentationReadiness = Read-RequiredFile "qa\VALIDATION_PRESENTATION_READINESS.md"
$finalUxAcceptanceChecklist = Read-RequiredFile "qa\FINAL_UX_ACCEPTANCE_CHECKLIST.md"

if ($installGuide -ne "") {
    foreach ($section in @(
        "Antes De Instalar",
        "Instalar",
        "Abrir El Sistema",
        "Arranque Automatico",
        "Respaldos Automaticos",
        "Validacion Inicial",
        "Cierre Final Antes De Operar",
        "Soporte",
        "Paquete Seguro Para Soporte"
    )) {
        Test-Contains $installGuide ([regex]::Escape($section)) "Installation guide includes section: $section"
    }

    foreach ($requiredText in @(
        'No borre carpetas de datos ni volumenes de base de datos',
        'no debe ofrecer una opcion de "instalacion limpia"',
        'migrate:fresh',
        'sin correr seeders de demostracion',
        'APP_VERSION',
        'https://IP-DEL-SERVIDOR',
        'APP_URL',
        'install_hospital_startup_shortcut.ps1',
        'install_stack_autostart_windows.ps1',
        'SistemaCajaHospitalaria-StackAutostart',
        'AtStartup',
        '-WhatIfOnly',
        'install_backup_tasks_windows.ps1',
        'install_backup_startup_current_user.ps1',
        'BackupWorker',
        'DailyBackup',
        'Pendiente',
        'Protegido',
        'LAN_CLIENT_VALIDATION_PROOF.md',
        'INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
        'FINAL_STARTUP_TASK_PROOF.md',
        'FINAL_BACKUP_TASK_PROOF.md',
        'FINAL_RESTORE_PROOF.md',
        'FINAL_CONCURRENCY_PROOF.md',
        'final_production_handoff.ps1',
        '-InitializeProofFiles',
        'PRODUCTION_CANDIDATE',
        'validate_lan_client.ps1',
        'repair_hospital_system.ps1',
        'LOCAL_REPAIR_DIAGNOSTIC.md',
        'collect_support_packet.ps1',
        'support-packets'
    )) {
        Test-Contains $installGuide ([regex]::Escape($requiredText)) "Installation guide includes safety text: $requiredText"
    }

    Test-Contains $installGuide '(?i)(No|Nunca)\s+escriba\s+usuario,\s+contrasena\s+ni\s+token\s+dentro\s+de\s+la\s+direccion' "Installation guide forbids credentials in URLs"
    Test-Contains $installGuide '(?i)ReportPath.*\.md.*qa' "Installation guide keeps handoff reports inside qa"
    Test-Contains $installGuide '(?i)EvidencePath.*\.md.*qa|ruta de `-EvidencePath` debe ser un archivo `\.md` dentro de `qa`' "Installation guide keeps LAN evidence inside qa"
    Test-Contains $installGuide '(?i)no se levanta Docker|no registra ni elimina tareas|no crea archivo Startup' "Installation guide documents non-mutating dry runs"
    Test-Contains $installGuide '(?i)no reinicia datos|no ejecuta\s+seeders|no restaura backups automaticamente' "Installation guide documents safe repair limits"
    Test-Contains $installGuide '(?i)No agregue archivos.*\.env|No borre.*\.env|No copie.*\.env' "Installation guide protects .env files"
    Test-NoProfilePowerShellCommands $installGuide "Installation guide"
}

if ($supportGuide -ne "") {
    Test-NoProfilePowerShellCommands $supportGuide "First-level support guide"
}

if ($backupGuide -ne "") {
    Test-NoProfilePowerShellCommands $backupGuide "Backup and restore guide"
}

if ($offlineLanInstallGuide -ne "") {
    Test-NoProfilePowerShellCommands $offlineLanInstallGuide "Offline LAN install guide"
    Test-NotContains $offlineLanInstallGuide '(?i)Levantar worker local|worker local de cola|worker local de backups|cuando el worker corre|`pending`|`success`|`failed`' "Offline LAN install guide avoids raw backup worker/status wording"
    Test-Contains $offlineLanInstallGuide 'automatizacion local de respaldos' "Offline LAN install guide uses operational backup automation wording"
    Test-Contains $offlineLanInstallGuide '(?s)Backup manual.*Pendiente.*Protegido.*Error' "Offline LAN install guide uses visible backup states"
}

if ($installSummary -ne "") {
    Test-NoProfilePowerShellCommands $installSummary "Install summary"
    Test-NotContains $installSummary '(?i)C:\\HospitalBilling\\backend|backup worker|worker continuo|`pending`|`success`|`failed`' "Install summary avoids legacy backup path and raw worker/status wording"
    Test-Contains $installSummary 'automatizacion local de respaldos' "Install summary uses operational backup automation wording"
    Test-Contains $installSummary '(?s)backup manual.*Pendiente.*Protegido' "Install summary uses visible backup states"
}

if ($fieldDeploymentValidation -ne "") {
    Test-NoProfilePowerShellCommands $fieldDeploymentValidation "Field deployment validation"
    Test-NotContains $fieldDeploymentValidation '(?i)C:\\HospitalBilling\\backend|historial, reportes y backup `pending` -> `success`|Worker real de backups|worker continuo' "Field deployment validation avoids legacy backup path and raw worker/status wording"
    Test-Contains $fieldDeploymentValidation 'Tarea continua real de respaldos' "Field deployment validation uses operational backup task heading"
    Test-Contains $fieldDeploymentValidation '(?s)backup \*\*Pendiente\*\* -> \*\*Protegido\*\*' "Field deployment validation uses visible backup state transition"
}

if ($dailyCloseProtocol -ne "") {
    Test-NotContains $dailyCloseProtocol '(?i)`pending`|`success`|`failed`|revisar worker' "Daily close protocol avoids raw backup status/worker wording"
    Test-Contains $dailyCloseProtocol '(?s)Backup.*Protegido.*Pendiente.*Error' "Daily close protocol uses visible backup states"
    Test-Contains $dailyCloseProtocol 'tarea continua de respaldos' "Daily close protocol uses operational backup task wording"
}

if ($implementationPlan -ne "") {
    Test-NotContains $implementationPlan '(?i)worker de backups|worker continuo|backup pending|`pending`\s*->\s*`success`' "Implementation plan avoids raw backup worker/status wording"
    Test-Contains $implementationPlan 'tarea continua de respaldos' "Implementation plan uses operational backup task wording"
}

foreach ($docInfo in @(
    @{ Content = $releaseChecklist; Label = "Release checklist" },
    @{ Content = $installSummary; Label = "Install summary" },
    @{ Content = $backupRestoreReference; Label = "Backup/restore reference" },
    @{ Content = $dailyCloseProtocol; Label = "Daily close protocol" },
    @{ Content = $disasterRecoveryGuide; Label = "Disaster recovery guide" },
    @{ Content = $trainingAdminGuide; Label = "Admin training guide" },
    @{ Content = $userManual; Label = "General user manual" },
    @{ Content = $userManualHtml; Label = "General user manual HTML" },
    @{ Content = $operatorIndex; Label = "Operator index" }
)) {
    if ($docInfo.Content -ne "") {
        Test-NoProfilePowerShellCommands $docInfo.Content $docInfo.Label
    }
}

if ($releaseChecklist -ne "") {
    Test-NotContains $releaseChecklist '(?i)backup pending|backup `pending`|cambio de `pending`|cambia de `pending`|pasa de `pending`|`pending`\s*->\s*`success`|worker continuo|worker local de backups|Confirmar worker local de backups' "Release checklist avoids raw backup status/worker wording"
    Test-NotContains $releaseChecklist '(?i)mockeado|mockeada|mocked|API mockeada|evidencia mockeada' "Release checklist uses controlled-evidence wording instead of mocked wording"
    Test-Contains $releaseChecklist 'Pendiente a Protegido' "Release checklist uses visible backup state transition"
    Test-Contains $releaseChecklist 'tarea continua de respaldos|automatizacion de respaldos' "Release checklist uses operational backup task wording"
    Test-Contains $releaseChecklist 'E2E en ambiente controlado' "Release checklist names controlled E2E evidence"
}

if ($docsIndex -ne "") {
    Test-NotContains $docsIndex '(?i)backup pending forever' "Documentation index avoids raw backup pending wording"
    Test-Contains $docsIndex 'respaldo que queda en Pendiente' "Documentation index uses visible backup status wording"
    Test-NotContains $docsIndex '(?i)Barcode QR|Barcode/QR|Scanner-driven|scanner-driven' "Documentation index uses operational service identifier wording"
    Test-Contains $docsIndex 'Service identifier entry for billing' "Documentation index names service identifier entry"
}

if ($posBillingUxSpec -ne "") {
    Test-NotContains $posBillingUxSpec '(?i)scanner y mouse|campo scanner|texto, categoria o scanner|codigo interno' "POS UX spec avoids scanner/code as visible product wording"
    Test-Contains $posBillingUxSpec 'identificador de servicio' "POS UX spec uses service identifier wording"
    Test-Contains $posBillingUxSpec 'sin mostrar esos valores al cajero' "POS UX spec keeps technical identifiers hidden from cashier"
}

if ($serviceScanWorkflow -ne "") {
    Test-NotContains $serviceScanWorkflow '(?i)Barcode QR Workflow|scanner USB|codigo escrito|QR/barcode|Flujo scanner|campo de scanner|codigo equivalente|Codigo duplicado|Buscar por codigo|Codigo inexistente' "Service scan workflow avoids legacy barcode/scanner/code wording"
    Test-Contains $serviceScanWorkflow 'identificador de servicio' "Service scan workflow uses service identifier wording"
    Test-Contains $serviceScanWorkflow 'No mostrar identificadores crudos' "Service scan workflow forbids raw identifiers in normal cashier surfaces"
}

if ($finalPhasesRoadmap -ne "") {
    Test-NotContains $finalPhasesRoadmap '(?i)barcode/QR/scan_code|soporte de codigo|busqueda por codigo|categoria/codigo' "Final phases roadmap uses operational service identifier wording"
    Test-Contains $finalPhasesRoadmap 'identificadores de servicio' "Final phases roadmap names service identifiers"
}

if ($releaseReadiness -ne "") {
    Test-NotContains $releaseReadiness '(?i)backup pending|backup manual `pending`|`pending`\s*->\s*`success`|Worker backups|Levantar worker de backups' "Release readiness avoids raw backup status/worker wording"
    Test-NotContains $releaseReadiness '(?i)scanner/c[o]digos|scanner/c[o]digo' "Release readiness uses operational service scanning wording"
    Test-NotContains $releaseReadiness '(?i)E2E mockeado|API mockeada|`scan_code`, `barcode`, `qr_code`' "Release readiness uses controlled evidence and operational identifier wording"
    Test-Contains $releaseReadiness 'respaldo manual de Pendiente a Protegido' "Release readiness uses visible backup state transition"
    Test-Contains $releaseReadiness 'Tarea de respaldos|tarea continua de respaldos' "Release readiness uses operational backup task wording"
    Test-Contains $releaseReadiness 'E2E en ambiente controlado' "Release readiness names controlled E2E evidence"
    Test-Contains $releaseReadiness 'identificadores administrables' "Release readiness names manageable service identifiers"
}

if ($finalExecutionPackIndex -ne "") {
    Test-NotContains $finalExecutionPackIndex '(?i)scanner/c[o]digos|scanner/c[o]digo|codigo, scanner|barcode/QR|POS puede agregar por categoria, texto o scanner|codigos planificados' "Final execution pack index uses operational service scanning wording"
    Test-Contains $finalExecutionPackIndex 'escaneo de servicios' "Final execution pack index names service scanning operationally"
}

if ($correctedFinalProductPlan -ne "") {
    Test-NotContains $correctedFinalProductPlan '(?i)Catalogo, codigos|estado y codigo|inactivo/codigo|soporte de codigo|Codigo existente|Codigo inexistente|busqueda/codigo|nombre/categoria/codigo' "Corrected final product plan uses service identifier wording"
    Test-NotContains $correctedFinalProductPlan '(?i)mockeado|mockeada|con mocks' "Corrected final product plan uses controlled-evidence wording"
    Test-Contains $correctedFinalProductPlan 'identificador' "Corrected final product plan names service identifiers"
    Test-Contains $correctedFinalProductPlan 'E2E en ambiente controlado' "Corrected final product plan names controlled E2E evidence"
}

if ($productionGapReport -ne "") {
    Test-NotContains $productionGapReport '(?i)backup pending|worker continuo|`pending`|`failed`|Levantar worker de backups' "Production gap report avoids raw backup status/worker wording"
    Test-Contains $productionGapReport 'respaldos manuales desde UI pueden quedarse en Pendiente o Error' "Production gap report uses visible backup risk wording"
    Test-Contains $productionGapReport 'tarea continua de respaldos' "Production gap report uses operational backup task wording"
}

if ($validationPresentationReadiness -ne "") {
    Test-NotContains $validationPresentationReadiness '(?i)worker continuo|worker de backups|backup pending|`pending`\s*->\s*`success`' "Validation presentation readiness avoids raw backup worker/status wording"
    Test-NotContains $validationPresentationReadiness '(?i)Codigos de validacion para scanner|codigo de validacion en scanner|barcode `|Catalogo:.*codigos|QR-LAB|QR-RX|alterno `|auxiliar `' "Validation presentation readiness uses operational identifier wording"
    Test-Contains $validationPresentationReadiness 'tarea continua de respaldos' "Validation presentation readiness uses operational backup task wording"
    Test-Contains $validationPresentationReadiness 'Identificadores primarios de validacion para escaneo de servicios' "Validation presentation readiness names primary validation identifiers operationally"
    Test-Contains $validationPresentationReadiness 'No mostrar identificadores alternos o auxiliares durante la presentacion' "Validation presentation readiness keeps auxiliary identifiers out of presentation"
}

if ($finalUxAcceptanceChecklist -ne "") {
    Test-NotContains $finalUxAcceptanceChecklist '(?i)worker continuo|worker de backups|backup pending|`pending`\s*->\s*`success`' "Final UX acceptance checklist avoids raw backup worker/status wording"
    Test-NotContains $finalUxAcceptanceChecklist '(?i)Scanner input visible|Barcode/QR fields' "Final UX acceptance checklist avoids legacy scanner/barcode wording"
    Test-NotContains $finalUxAcceptanceChecklist '(?i)mockeado|mockeada|mocked|gate separado del mock' "Final UX acceptance checklist uses controlled-evidence wording"
    Test-Contains $finalUxAcceptanceChecklist 'tarea continua de respaldos' "Final UX acceptance checklist uses operational backup task wording"
    Test-Contains $finalUxAcceptanceChecklist 'Campo de identificador de servicio' "Final UX acceptance checklist names service identifier field"
    Test-Contains $finalUxAcceptanceChecklist 'E2E en ambiente controlado' "Final UX acceptance checklist names controlled E2E evidence"
}

if ($finalProductionHandoffScript -ne "") {
    Test-NotContains $finalProductionHandoffScript '(?i)mocked E2E screenshots|mocked browser evidence|rc-e2e-mocked-report\.json' "Final production handoff script uses controlled browser evidence wording"
    Test-NotContains $finalProductionHandoffScript '(?i)Final production handoff result|Generated at|Project root|Proof present without obvious placeholders|proof file:|## Result\b|## Blocking items\b|Evidence completed in this hardening front|Files changed in this handoff front|Tests and gates to preserve|Risks and limits|Safety notes|Browser and operational smoke|Controlled browser smoke screenshots|Local Docker and controlled browser evidence' "Final production handoff script uses Spanish institutional handoff wording"
    Test-Contains $finalProductionHandoffScript 'Capturas controladas de navegador' "Final production handoff script names controlled browser screenshots operationally"
    Test-Contains $finalProductionHandoffScript 'Resultado de handoff final de produccion' "Final production handoff script uses Spanish title"
    Test-Contains $finalProductionHandoffScript 'Pendientes bloqueantes' "Final production handoff script uses Spanish blocker heading"
    Test-Contains $finalProductionHandoffScript 'Evidencia completada en este frente de endurecimiento' "Final production handoff script uses Spanish evidence heading"
    Test-Contains $finalProductionHandoffScript 'Notas de seguridad' "Final production handoff script uses Spanish safety heading"
}

if ($troubleshootingGuide -ne "") {
    Test-NotContains $troubleshootingGuide '(?i)backup entry in `pending`|`pending`\s*state for hours|Respaldo pendiente" never finishes' "Troubleshooting guide avoids raw backup pending wording"
    Test-Contains $troubleshootingGuide 'Respaldo pendiente" nunca termina' "Troubleshooting guide uses Spanish operator backup title"
    Test-Contains $troubleshootingGuide 'Pendiente' "Troubleshooting guide uses visible backup state"
}

if ($userManual -ne "") {
    Test-Contains $userManual '(?i)Ayuda\s*>\s*Preparar resumen|Preparar resumen' "General user manual routes incidents to safe support summary"
    Test-Contains $userManual '(?i)avise a soporte local|soporte local' "General user manual routes unavailable system to local support"
    Test-Contains $userManual '(?i)no repita facturas ni cobros|no repita.*cobro' "General user manual warns against duplicate financial actions during incidents"
    Test-Contains $userManual '(?i)archivos de configuracion|respaldos de base de datos|contrasenas' "General user manual uses non-technical secret handling wording"
    Test-NotContains $userManual '(?i)powershell|repair_hospital_system|collect_support_packet|127\.0\.0\.1|localhost:8000|migrate:fresh|seeders de prueba|\.env|SQL|BaseUrl' "General user manual avoids support commands and raw technical terms"
}

if ($userManualHtml -ne "") {
    Test-Contains $userManualHtml '(?i)Ayuda\s*&gt;\s*Preparar resumen|Preparar resumen' "General user manual HTML routes incidents to safe support summary"
    Test-Contains $userManualHtml '(?i)avise a soporte local|soporte local' "General user manual HTML routes unavailable system to local support"
    Test-Contains $userManualHtml '(?i)no repita facturas ni cobros|no repita.*cobro' "General user manual HTML warns against duplicate financial actions during incidents"
    Test-Contains $userManualHtml '(?i)archivos de configuracion|respaldos de base de datos|contrasenas' "General user manual HTML uses non-technical secret handling wording"
    Test-NotContains $userManualHtml '(?i)powershell|repair_hospital_system|collect_support_packet|127\.0\.0\.1|localhost:8000|migrate:fresh|seeders de prueba|\.env|SQL|BaseUrl' "General user manual HTML avoids support commands and raw technical terms"
}

$combined = "$installGuide`n$supportGuide`n$backupGuide`n$offlineLanInstallGuide`n$backupRestoreReference`n$dailyCloseProtocol`n$disasterRecoveryGuide`n$trainingAdminGuide`n$userManual`n$userManualHtml`n$operatorIndex`n$releaseChecklist`n$installSummary`n$fieldDeploymentValidation"
foreach ($requiredText in @(
    'PRODUCTION_READY',
    'PRODUCTION_CANDIDATE',
    'No ejecutar `migrate:fresh` en el servidor real',
    'no restaura backups automaticamente',
    'no reemplaza un archivo existente por accidente',
    'no sobrescribe',
    'No declare la instalacion lista para produccion',
    'segunda computadora',
    'impresora institucional',
    'base descartable',
    'concurrencia',
    'make_offline_release.ps1 -SelfTest',
    'validate_dependency_manifest.ps1',
    'package_manifest.json'
)) {
    Test-Contains $combined ([regex]::Escape($requiredText)) "Install/release docs include guardrail: $requiredText"
}

if ($combined -match "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*=") {
    Add-Failure "Installation/support docs expose secret-like assignments."
} else {
    Add-Pass "Installation/support docs do not expose secret-like assignments"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "INSTALLATION_DOCS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "INSTALLATION_DOCS_SAFETY: YES" -ForegroundColor Green
