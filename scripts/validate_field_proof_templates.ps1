param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-TemplateGuardText([string] $value) {
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
    $failures.Add((Protect-TemplateGuardText $message)) | Out-Null
}

function Assert-TemplateContent([string] $content, [string] $pattern, [string] $message) {
    if ($content -notmatch $pattern) {
        Add-Failure $message
    }
}

function Assert-Field([string] $content, [string] $path, [string] $label) {
    $expected = "- ${label}:"
    $found = $false
    foreach ($line in ($content -split "`r?`n")) {
        if ($line.Trim() -eq $expected) {
            $found = $true
            break
        }
    }

    if (-not $found) {
        Add-Failure "Missing required field '${label}:' in $path."
    }
}

function Assert-Check([string] $content, [string] $path, [string] $labelPattern, [bool] $RequireResultEvidence = $true) {
    $found = $false
    foreach ($line in ($content -split "`r?`n")) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith("- [ ]") -and $trimmed.Contains($labelPattern)) {
            if (-not $RequireResultEvidence -or $trimmed.EndsWith("Result/evidence:")) {
                $found = $true
                break
            }
        }
    }

    if (-not $found) {
        $suffix = if ($RequireResultEvidence) { " with Result/evidence" } else { "" }
        Add-Failure "Missing required unchecked check '$labelPattern'$suffix in $path."
    }
}

function Test-Template([string] $relativePath, [string[]] $fields, [string[]] $checks, [string[]] $safetyTerms, [bool] $RequireCheckResult = $true) {
    $failureCountBeforeTemplate = $failures.Count
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing field proof template: $relativePath."
        return
    }

    $content = Get-Content -LiteralPath $path -Raw
    foreach ($field in $fields) {
        Assert-Field $content $relativePath $field
    }

    foreach ($check in $checks) {
        Assert-Check $content $relativePath $check $RequireCheckResult
    }

    foreach ($term in $safetyTerms) {
        Assert-TemplateContent $content ([regex]::Escape($term)) "Missing safety instruction '$term' in $relativePath."
    }

    $forbiddenPatterns = @(
        @{ Pattern = ('(?i)' + 'Billing' + '\s+' + 'OS'); Message = 'Legacy branding found' },
        @{ Pattern = '(?i)APP_KEY\s*[:=]\s*[^\s`]+'; Message = 'APP_KEY-like assignment found' },
        @{ Pattern = '(?i)DB_PASSWORD\s*[:=]\s*[^\s`]+'; Message = 'DB_PASSWORD-like assignment found' },
        @{ Pattern = '(?i)(TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^\s`]+'; Message = 'Secret-like assignment found' },
        @{ Pattern = '(?i)[A-Z]:\\(?![\\])'; Message = 'Absolute Windows path found' },
        @{ Pattern = '(?i)/(var|home|srv|opt|tmp|usr|mnt)/'; Message = 'Absolute local path found' }
    )

    foreach ($item in $forbiddenPatterns) {
        if ($content -match $item.Pattern) {
            Add-Failure "$($item.Message) in $relativePath."
        }
    }

    if ($failures.Count -eq $failureCountBeforeTemplate) {
        Write-Host "[ OK ] $relativePath keeps required fields, checks and safety instructions." -ForegroundColor Green
    }
}

Test-Template `
    -relativePath "qa\LAN_CLIENT_VALIDATION_PROOF.example.md" `
    -fields @(
        "Date/time",
        "Responsible person",
        "Client computer name",
        "Server IP or LAN name",
        "Server LAN URL",
        "Client browser/version",
        "User/role used",
        "Evidence/capture reference",
        "Final conclusion"
    ) `
    -checks @(
        "/up",
        "/login",
        "/verify-email",
        "/assets/*.js",
        "Login",
        "Cashbox",
        "Invoice",
        "Payment",
        "Receipt",
        "history",
        "Reports",
        "Pendiente a Protegido"
    ) `
    -safetyTerms @(
        'second computer',
        'Do not mark `PRODUCTION_READY`',
        'Do not rename required field labels'
    )

Test-Template `
    -relativePath "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md" `
    -fields @(
        "Date/time",
        "Responsible person",
        "Printer brand/model",
        "Printer driver",
        "Connection type",
        "Browser/version",
        "Cashier computer",
        "Invoice used",
        "Evidence/photo reference",
        "Final conclusion",
        "Media carta result",
        "Carta result",
        "A5 result",
        "Reprint result",
        "Margins result",
        "Browser headers/footers result",
        "Problems found"
    ) `
    -checks @(
        "Media carta",
        "Carta",
        "A5",
        "white background",
        "Reprint",
        "headers/footers",
        "historical"
    ) `
    -safetyTerms @(
        "physical printer",
        "Do not mark",
        "Do not rename required field labels"
    )

Test-Template `
    -relativePath "qa\FINAL_RESTORE_PROOF.example.md" `
    -fields @(
        "Date/time",
        "Responsible person",
        "Source database",
        "Disposable restore database",
        "Backup file (relative path or filename only, no absolute server path)",
        "Backup SHA256",
        "Backup size bytes",
        "Evidence/capture reference",
        "Final conclusion"
    ) `
    -checks @(
        "Disposable restore database",
        "Backup file",
        "Restore imports",
        "Migration table",
        "Services table",
        "Core counts"
    ) `
    -safetyTerms @(
        "disposable database",
        "Do not restore into",
        "must stay under"
    )

Test-Template `
    -relativePath "qa\FINAL_STARTUP_TASK_PROOF.example.md" `
    -fields @(
        "Date/time",
        "Responsible person",
        "Server computer name",
        "Startup task status",
        "Startup task trigger",
        "Startup command check",
        "Startup or reboot test time",
        "Server URL after startup",
        "Evidence/capture reference",
        "Final conclusion"
    ) `
    -checks @(
        "SistemaCajaHospitalaria-StackAutostart",
        "AtStartup",
        "supported hospital startup script",
        "startup or a supervised manual task start",
        "/up",
        "Login page",
        "Evidence does not include"
    ) `
    -safetyTerms @(
        "final server",
        "AtStartup",
        "Do not attach"
    )

Test-Template `
    -relativePath "qa\FINAL_BACKUP_TASK_PROOF.example.md" `
    -fields @(
        "Date/time",
        "Responsible person",
        "Server computer name",
        "Backup worker task status",
        "Daily backup task status",
        "Manual backup request time",
        "Backup log id or filename",
        "Backup size bytes",
        "Evidence/capture reference",
        "Final conclusion"
    ) `
    -checks @(
        "SistemaCajaHospitalaria-BackupWorker",
        "SistemaCajaHospitalaria-DailyBackup",
        "Backup worker",
        "Manual backup",
        "Pendiente a Protegido",
        "timestamp and size",
        "Evidence does not include"
    ) `
    -safetyTerms @(
        "final server",
        "admin UI",
        "Do not attach"
    )

Test-Template `
    -relativePath "qa\FINAL_CONCURRENCY_PROOF.example.md" `
    -fields @(
        "Date/time",
        "Responsible person",
        "Server LAN URL",
        "Target environment",
        "Run ID",
        "Evidence/capture reference",
        "Final conclusion"
    ) `
    -checks @(
        "Double cash-session open",
        "Concurrent invoice emission",
        "Double payment"
    ) `
    -safetyTerms @(
        "disposable server/database snapshot",
        "Do not run this against live production data",
        "do not include credentials"
    )

Test-Template `
    -relativePath "qa\TRAINING_ACCEPTANCE_PROOF.example.md" `
    -fields @(
        "Date/time",
        "Responsible person",
        "Training environment name",
        "Training environment URL or location",
        "Evidence/capture reference",
        "Final conclusion"
    ) `
    -checks @(
        "Training did not use the production database",
        "Training did not use real patient data",
        "Training did not use real cashier shift users",
        "Training did not restore over the real database",
        "Training did not print receipts that could be confused with real fiscal documents",
        "Training did not expose",
        "Cashier role practiced",
        "Supervisor role practiced",
        "Administrator role practiced",
        "Server unavailable",
        "LAN down",
        "Printer not responding",
        "Power loss",
        "Browser closed",
        "Cashbox left open",
        "Backup failed",
        "Session expired",
        "Permission denied",
        "Database requires restore"
    ) `
    -safetyTerms @(
        "supervised training",
        "Keep it anonymous",
        'Do not mark `PRODUCTION_READY`'
    ) `
    -RequireCheckResult $false

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "FIELD_PROOF_TEMPLATES: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "FIELD_PROOF_TEMPLATES: YES" -ForegroundColor Green
Write-Host "Final-field proof templates match preflight-required labels, checks and safety instructions." -ForegroundColor Green
