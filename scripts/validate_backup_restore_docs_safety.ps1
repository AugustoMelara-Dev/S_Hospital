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

function Require-File([string] $relativePath) {
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

$guide = Require-File "docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md"
$backupRestoreReference = Require-File "docs\BACKUP_RESTORE.md"
$installGuide = Require-File "docs\manuales\GUIA_INSTALACION_OPERATIVA.md"
$supportGuide = Require-File "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md"

if ($guide -ne "") {
    foreach ($pattern in @(
        "Crear Respaldo Manual",
        "Respaldos Automaticos",
        "Retencion de respaldos",
        "validate_backup_worker_smoke.ps1",
        "qa\BACKUP_WORKER_SMOKE_PROOF.md",
        "qa\FINAL_BACKUP_TASK_PROOF.md",
        "Restauracion",
        "qa\FINAL_RESTORE_PROOF.md",
        "validate_restore_mysql.sh",
        "HOSPITAL_VALIDATE_RESTORE_MYSQL=1"
    )) {
        Test-Contains $guide ([regex]::Escape($pattern)) "Backup/restore guide includes $pattern"
    }

    Test-Contains $guide "(?i)base descartable|ambiente seguro" "Restore guide requires disposable/safe restore target"
    Test-Contains $guide "(?i)nunca\s+sobre\s+la\s+base\s+real|Nunca restaure\s+sobre\s+la\s+base\s+activa" "Restore guide forbids restoring over production for testing"
    Test-Contains $guide "(?i)SHA256|tamano|conteos principales|base origen" "Restore guide requires verifiable restore evidence fields"
    Test-Contains $guide "(?i)No existe restauracion por interfaz normal" "Restore guide explains no normal UI restore"
    Test-Contains $guide "(?i)no escriba usuario, contrasena ni token dentro de .*HOSPITAL_SMOKE_BASE_URL" "Backup automation smoke avoids credentials in URL"
}

if ($backupRestoreReference -ne "") {
    Test-Contains $backupRestoreReference 'C:\\Hospital\\Sistema\\backend' "Backup/restore reference uses neutral installation path"
    Test-Contains $backupRestoreReference '(?s)Crear backup manual.*Pendiente.*Protegido' "Backup/restore reference uses visible states in manual backup flow"
    Test-Contains $backupRestoreReference 'tarea continua de respaldos activa' "Backup/restore reference uses operational backup task wording"

    if ($backupRestoreReference -match 'C:\\HospitalBilling\\backend|worker de cola local|worker local lo cambie|cola `backups`') {
        Add-Failure "Backup/restore reference keeps legacy billing path or raw worker wording in operator-facing backup flow."
    } else {
        Add-Pass "Backup/restore reference avoids legacy billing path and raw worker wording in backup flow"
    }
}

$combined = "$guide`n$backupRestoreReference`n$installGuide`n$supportGuide"
foreach ($pattern in @(
    "No borre",
    "No restaure",
    "No ejecute seeders",
    "no restaura backups automaticamente",
    "paquete de soporte"
)) {
    Test-Contains $combined ([regex]::Escape($pattern)) "Backup/support docs include safety term: $pattern"
}
Test-Contains $combined "(?i)No agregue archivos .*\.env" "Backup/support docs include safety term: No agregue archivos .env"

if ($combined -match "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*=") {
    Add-Failure "Backup/restore docs expose secret-like assignments."
} else {
    Add-Pass "Backup/restore docs do not expose secret-like assignments"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "BACKUP_RESTORE_DOCS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "BACKUP_RESTORE_DOCS_SAFETY: YES" -ForegroundColor Green
