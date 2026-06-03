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

$installGuide = Read-RequiredFile "docs\manuales\GUIA_INSTALACION_OPERATIVA.md"
$supportGuide = Read-RequiredFile "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"

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
        'http://IP-DEL-SERVIDOR:8000',
        'APP_URL',
        'install_hospital_startup_shortcut.ps1',
        '-WhatIfOnly',
        'install_backup_tasks_windows.ps1',
        'install_backup_startup_current_user.ps1',
        'BackupWorker',
        'DailyBackup',
        'Pendiente',
        'Protegido',
        'LAN_CLIENT_VALIDATION_PROOF.md',
        'INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
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
}

$combined = "$installGuide`n$supportGuide`n$releaseChecklist"
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
