param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$failures = New-Object System.Collections.Generic.List[string]

function Protect-StartupSafetyText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    if (-not [string]::IsNullOrWhiteSpace($ProjectRoot)) {
        $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-StartupSafetyText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-StartupSafetyText $message)" -ForegroundColor Green
}

function Require-File([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
        return $path
    }

    Add-Failure "Missing required startup/recovery file: $relativePath"
    return $null
}

function Test-ScriptDoesNotContainDestructiveOperations([string] $relativePath, [string] $path) {
    if ($null -eq $path) {
        return
    }

    $content = Get-Content -LiteralPath $path -Raw
    $forbiddenPatterns = @(
        @{ Pattern = '(?i)docker\s+volume\s+rm'; Label = 'docker volume rm' },
        @{ Pattern = '(?i)docker\s+compose\b.*\bdown\b.*\s-v(\s|$)'; Label = 'docker compose down -v' },
        @{ Pattern = '(?i)\bphp\b.*\bartisan\b.*\bmigrate:fresh\b'; Label = 'php artisan migrate:fresh' },
        @{ Pattern = '(?i)\bphp\b.*\bartisan\b.*\bdb:wipe\b'; Label = 'php artisan db:wipe' },
        @{ Pattern = '(?i)\bDROP\s+DATABASE\b'; Label = 'DROP DATABASE' },
        @{ Pattern = '(?i)\bTRUNCATE\s+TABLE\b'; Label = 'TRUNCATE TABLE' },
        @{ Pattern = '(?i)Remove-Item\b.*(\.env|storage[\\/]+app[\\/]+private[\\/]+backups|mysql|mariadb|docker)'; Label = 'destructive Remove-Item target' }
    )

    foreach ($rule in $forbiddenPatterns) {
        if ($content -match $rule.Pattern) {
            Add-Failure "$relativePath contains forbidden operation: $($rule.Label)"
        }
    }

    if ($content -match '(?i)No borre datos|No se borran datos|no se reinicia la base|no se ejecutan seeders') {
        Add-Pass "$relativePath includes human safety warning"
    } else {
        Add-Failure "$relativePath must include a human safety warning before recovery actions"
    }
}

function Invoke-SafeCheck([string] $label, [string[]] $arguments, [string[]] $requiredOutput) {
    $output = @(& powershell.exe -NoProfile @arguments 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-StartupSafetyText $_) }

    if ($exitCode -ne 0) {
        Add-Failure "$label returned exit code $exitCode"
        return
    }

    $joined = $output -join "`n"
    foreach ($expected in $requiredOutput) {
        if ($joined -notmatch [regex]::Escape($expected)) {
            Add-Failure "$label did not print expected safety text: $expected"
        }
    }

    Add-Pass "$label completed in safe mode"
}

$startupScript = Require-File "scripts\start_hospital_services.ps1"
$repairScript = Require-File "scripts\repair_hospital_system.ps1"
$openScript = Require-File "scripts\open_hospital_system.ps1"
$shortcutScript = Require-File "scripts\install_hospital_startup_shortcut.ps1"
$backupTasksScript = Require-File "scripts\install_backup_tasks_windows.ps1"
$handoffScript = Require-File "scripts\final_production_handoff.ps1"
$preflightScript = Require-File "scripts\production_readiness_preflight.ps1"

Test-ScriptDoesNotContainDestructiveOperations "scripts\start_hospital_services.ps1" $startupScript
Test-ScriptDoesNotContainDestructiveOperations "scripts\repair_hospital_system.ps1" $repairScript
Test-ScriptDoesNotContainDestructiveOperations "scripts\open_hospital_system.ps1" $openScript

foreach ($scriptInfo in @(
    @{ Relative = "scripts\final_production_handoff.ps1"; Path = $handoffScript },
    @{ Relative = "scripts\production_readiness_preflight.ps1"; Path = $preflightScript }
)) {
    if ($null -ne $scriptInfo.Path) {
        $content = Get-Content -LiteralPath $scriptInfo.Path -Raw
        if ($content -match 'powershell\.exe\s+-ExecutionPolicy') {
            Add-Failure "$($scriptInfo.Relative) invokes PowerShell without -NoProfile."
        } else {
            Add-Pass "$($scriptInfo.Relative) uses -NoProfile for nested PowerShell calls"
        }
    }
}

if ($failures.Count -eq 0) {
    Invoke-SafeCheck `
        "Startup dry run" `
        @("-ExecutionPolicy", "Bypass", "-File", $startupScript, "-ProjectRoot", $ProjectRoot, "-WhatIfOnly") `
        @("Modo WhatIf: no se levanta Docker y no se modifican contenedores.")

    Invoke-SafeCheck `
        "Repair dry run" `
        @("-ExecutionPolicy", "Bypass", "-File", $repairScript, "-ProjectRoot", $ProjectRoot, "-ReportPath", "qa\diagnostics\startup-repair-safety.tmp.md", "-BaseUrl", "http://127.0.0.1:8000", "-WhatIfOnly", "-NoBrowser", "-SkipDockerStart", "-Retries", "1", "-DelaySeconds", "1") `
        @("Modo WhatIf: no se levanta Docker, no se abre navegador y no se escribe diagnostico.")

    Invoke-SafeCheck `
        "Shortcut dry run" `
        @("-ExecutionPolicy", "Bypass", "-File", $shortcutScript, "-ProjectRoot", $ProjectRoot, "-Url", "http://127.0.0.1:8000", "-WhatIfOnly") `
        @("Modo WhatIf: no se creo acceso directo ni tarea de inicio.")

    Invoke-SafeCheck `
        "Backup task dry run" `
        @("-ExecutionPolicy", "Bypass", "-File", $backupTasksScript, "-ProjectRoot", $ProjectRoot, "-PhpPath", "php", "-DailyBackupTime", "23:30", "-WhatIfOnly") `
        @("Modo WhatIf: no se registraron, actualizaron ni eliminaron tareas.")
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "STARTUP_REPAIR_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "STARTUP_REPAIR_SAFETY: YES" -ForegroundColor Green
