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

function Get-RequiredContent([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Test-DoesNotContain([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

function Invoke-InstallerCheck([string] $label, [string[]] $arguments, [int] $expectedExit, [string[]] $requiredOutput) {
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot "scripts\install_backup_startup_current_user.ps1") @arguments 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $joined = $output -join "`n"
    $output | ForEach-Object { Write-Host $_ }

    if ($exitCode -ne $expectedExit) {
        Add-Failure "$label returned exit code $exitCode; expected $expectedExit."
        return
    }

    foreach ($expected in $requiredOutput) {
        if ($joined -notmatch [regex]::Escape($expected)) {
            Add-Failure "$label did not print expected text: $expected"
        }
    }

    if ($joined -match "(?i)(APP_KEY|DB_PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+") {
        Add-Failure "$label exposed secret-like assignments."
    }

    if ($joined -match "(?i)[A-Z]:\\Users\\[^\\\r\n]+") {
        Add-Failure "$label exposed a local user profile path."
    }

    if ($joined -match "(?i)/(var|home|srv|opt|tmp|usr|mnt)/[^\s`"']+") {
        Add-Failure "$label exposed an absolute local Unix path."
    }

    if ($joined -match '(?is)<(Task|Actions|Principals|Triggers|Settings)\b') {
        Add-Failure "$label exposed raw scheduled-task XML."
    }

    Add-Pass "$label completed with expected safety behavior"
}

$installer = Get-RequiredContent "scripts\install_backup_startup_current_user.ps1"
$launcher = Get-RequiredContent "scripts\start_backup_automation.cmd"
$loop = Get-RequiredContent "scripts\run_backup_scheduler_loop.ps1"
$installGuide = Get-RequiredContent "docs\manuales\GUIA_INSTALACION_OPERATIVA.md"
$backupGuide = Get-RequiredContent "docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md"
$supportEvidence = Get-RequiredContent "qa\OPERATIONAL_SUPPORT_EVIDENCE_2026-05-31.md"

if ($installer -ne "") {
    Test-Contains $installer '\[switch\]\s*\$WhatIfOnly' "Installer exposes WhatIfOnly"
    Test-Contains $installer '\[switch\]\s*\$Status' "Installer exposes Status"
    Test-Contains $installer '\[switch\]\s*\$Uninstall' "Installer exposes Uninstall"
    Test-Contains $installer '\[switch\]\s*\$StartNow' "Installer exposes StartNow"
    Test-Contains $installer 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' "Installer uses current-user HKCU Run"
    Test-Contains $installer 'GetFolderPath\("Startup"\)' "Installer uses current-user Startup folder"
    Test-Contains $installer 'Protect-StartupText' "Installer sanitizes operator output"
    Test-Contains $installer '\(\?i\)/\(var\|home\|srv\|opt\|tmp\|usr\|mnt\)/' "Installer redacts Unix local paths"
    Test-Contains $installer '\(\?is\)<\(Task\|Actions\|Principals\|Triggers\|Settings\)\\b' "Installer redacts raw task XML"
    Test-Contains $installer '\[xml-protegido\]' "Installer uses protected XML marker"
    Test-Contains $installer 'Modo WhatIf: no se crea archivo de inicio, no se cambia el registro y no se inicia la automatizacion de respaldos.' "Installer dry run states no writes/process start"
    Test-Contains $installer 'No borre respaldos, archivos \.env, volumenes Docker ni carpetas de datos' "Installer trap warns against destructive recovery"
    Test-Contains $installer 'Remove-Item\s+-LiteralPath\s+\$startupFile\s+-Force' "Installer uninstall only removes Startup file"
    Test-Contains $installer 'Remove-ItemProperty\s+-Path\s+\$runKeyPath\s+-Name\s+\$runKeyName' "Installer uninstall only removes HKCU Run value"
    Test-DoesNotContain $installer 'HKLM:' "Installer does not write machine-wide Run keys"
    Test-DoesNotContain $installer 'Remove-Item\s+.*-Recurse' "Installer does not recursively delete files"
    Test-DoesNotContain $installer '(?i)docker\s+compose\b.*\bdown\b.*\s-v(\s|$)|docker\s+volume\s+rm|migrate:fresh|db:wipe|DROP\s+DATABASE' "Installer avoids destructive database/container operations"
}

if ($launcher -ne "") {
    Test-Contains $launcher '--check' "Launcher supports check-only mode"
    Test-Contains $launcher 'powershell\.exe -NoProfile -ExecutionPolicy Bypass' "Launcher uses NoProfile PowerShell"
    Test-Contains $launcher '-WindowStyle Hidden' "Launcher starts background automation hidden"
    Test-Contains $launcher 'No se pudo iniciar la automatizacion de respaldos' "Launcher has human failure message"
    Test-DoesNotContain $launcher '(?i)APP_KEY|DB_PASSWORD|TOKEN|SECRET|MAIL_PASSWORD' "Launcher does not contain secret names"
}

if ($loop -ne "") {
    Test-Contains $loop '\[switch\]\s*\$WhatIfOnly' "Scheduler loop exposes WhatIfOnly"
    Test-Contains $loop 'No se inicio la automatizacion de respaldos, no se ejecuto respaldo y no se escribieron archivos' "Scheduler WhatIf states no automation, backup or writes"
    Test-Contains $loop 'Local\\SistemaCajaHospitalariaBackupAutomation' "Scheduler uses single-instance mutex"
    Test-Contains $loop 'Get-SafeAutomationText' "Scheduler sanitizes log/output text"
    Test-Contains $loop '\(\?i\)/\(var\|home\|srv\|opt\|tmp\|usr\|mnt\)/' "Scheduler redacts Unix local paths"
    Test-Contains $loop '\(\?is\)<\(Task\|Actions\|Principals\|Triggers\|Settings\)\\b' "Scheduler redacts raw task XML"
    Test-Contains $loop '\[xml-protegido\]' "Scheduler uses protected XML marker"
    Test-DoesNotContain $loop '(?i)docker\s+compose\b.*\bdown\b.*\s-v(\s|$)|docker\s+volume\s+rm|migrate:fresh|db:wipe|DROP\s+DATABASE' "Scheduler avoids destructive database/container operations"
}

$combinedDocs = "$installGuide`n$backupGuide`n$supportEvidence"
if ($combinedDocs -ne "") {
    Test-Contains $combinedDocs 'install_backup_startup_current_user\.ps1' "Docs mention current-user backup startup installer"
    Test-Contains $combinedDocs 'sin crear archivo Startup, sin cambiar registro y sin\s+iniciar la automatizacion de respaldos' "Docs explain current-user dry run safety"
    Test-DoesNotContain $combinedDocs '(?i)sin\s+iniciar\s+worker|no\s+inicia\s+worker|no\s+inicio\s+worker' "Docs avoid raw worker wording for current-user dry run"
    Test-Contains $combinedDocs 'Startup/HKCU Run' "Docs mention Startup/HKCU fallback"
    Test-Contains $combinedDocs 'No borre|No restaure|No agregue archivos .*\.env' "Docs keep backup startup safety warnings"
}

if ($failures.Count -eq 0) {
    $safePhpPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    Invoke-InstallerCheck `
        "Current-user backup startup dry run" `
        @("-ProjectRoot", $ProjectRoot, "-PhpPath", $safePhpPath, "-DailyBackupTime", "23:30", "-WhatIfOnly") `
        0 `
        @(
            "Validacion de arranque de backups completada.",
            "Modo WhatIf: no se crea archivo de inicio, no se cambia el registro y no se inicia la automatizacion de respaldos.",
            "Hora diaria validada: 23:30"
        )

    Invoke-InstallerCheck `
        "Current-user backup startup invalid time" `
        @("-ProjectRoot", $ProjectRoot, "-PhpPath", $safePhpPath, "-DailyBackupTime", "99:99", "-WhatIfOnly") `
        1 `
        @(
            "DailyBackupTime debe usar formato HH:mm de 24 horas",
            "No borre respaldos, archivos .env, volumenes Docker ni carpetas de datos"
        )

    Invoke-InstallerCheck `
        "Current-user backup startup status" `
        @("-ProjectRoot", $ProjectRoot, "-Status") `
        0 `
        @(
            "Automatizacion en carpeta Startup:",
            "Automatizacion HKCU Run:"
        )
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "BACKUP_STARTUP_CURRENT_USER_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "BACKUP_STARTUP_CURRENT_USER_SAFETY: YES" -ForegroundColor Green
