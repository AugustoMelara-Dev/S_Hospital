param(
    [string] $ProjectRoot = "",
    [string] $ExpectedCurrentCommit = "",
    [string] $ExpectedTargetCommit = "",
    [string] $ReportPath = "",
    [switch] $AllowDirtyGit
)

$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
$passes = New-Object System.Collections.Generic.List[string]

function Protect-UpdateText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|DB_ROOT_PASSWORD|PASSWORD|TOKEN|SECRET|SALT)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'

    return $protected
}

function Add-Pass([string] $message) {
    $safe = Protect-UpdateText $message
    $passes.Add($safe) | Out-Null
    Write-Host "[ OK ] $safe" -ForegroundColor Green
}

function Add-Warning([string] $message) {
    $safe = Protect-UpdateText $message
    $warnings.Add($safe) | Out-Null
    Write-Host "[WARN] $safe" -ForegroundColor Yellow
}

function Add-Failure([string] $message) {
    $safe = Protect-UpdateText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Test-RequiredFile([string] $relativePath, [string] $purpose) {
    $path = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "$purpose exists: $relativePath"
        return
    }

    Add-Failure "$purpose missing: $relativePath"
}

function Test-RequiredDirectory([string] $relativePath, [string] $purpose) {
    $path = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $path -PathType Container) {
        Add-Pass "$purpose exists: $relativePath"
        return
    }

    Add-Failure "$purpose missing: $relativePath"
}

function Test-GitState {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($null -eq $git) {
        Add-Warning "git is not available. Validate package MANIFEST/release notes manually."
        return
    }

    Push-Location $ProjectRoot
    try {
        & git rev-parse --is-inside-work-tree *> $null
        if ($LASTEXITCODE -ne 0) {
            Add-Warning "Project is not a Git worktree. Validate package MANIFEST/release notes manually."
            return
        }

        $head = (& git rev-parse HEAD).Trim()
        Add-Pass "Git HEAD detected: $head"

        if (-not [string]::IsNullOrWhiteSpace($ExpectedCurrentCommit) -and $head -ne $ExpectedCurrentCommit) {
            Add-Failure "Installed HEAD does not match ExpectedCurrentCommit. Expected $ExpectedCurrentCommit, got $head."
        }

        if (-not [string]::IsNullOrWhiteSpace($ExpectedTargetCommit) -and $head -eq $ExpectedTargetCommit) {
            Add-Warning "Current HEAD already equals ExpectedTargetCommit. Confirm whether the update already ran."
        }

        $status = (& git status --short --untracked-files=all)
        if ($status.Count -eq 0) {
            Add-Pass "Git status is clean"
        } elseif ($AllowDirtyGit) {
            Add-Warning "Git status is dirty but -AllowDirtyGit was used. Preserve local files before updating."
        } else {
            Add-Failure "Git status is dirty. Commit/stash support-only changes or use an offline package workflow before updating."
        }

        $trackedSecrets = (& git ls-files ".env" "backend/.env" "frontend/.env" 2>$null)
        if ($trackedSecrets.Count -eq 0) {
            Add-Pass "Real .env files are not tracked by Git"
        } else {
            Add-Failure "Real .env file is tracked by Git: $($trackedSecrets -join ', ')"
        }
    } finally {
        Pop-Location
    }
}

function Test-EnvProtection {
    $rootEnv = Join-Path $ProjectRoot ".env"
    $backendEnv = Join-Path $ProjectRoot "backend\.env"

    if ((Test-Path -LiteralPath $rootEnv -PathType Leaf) -or (Test-Path -LiteralPath $backendEnv -PathType Leaf)) {
        Add-Pass "A real environment file exists and must be preserved during update"
    } else {
        Add-Warning "No real .env file found in project root or backend. This is acceptable in source worktrees, not in an installed server."
    }

    Test-RequiredFile "backend\.env.example" "Backend environment template"
}

function Test-StorageProtection {
    Test-RequiredDirectory "backend\storage" "Laravel storage root"
    Test-RequiredDirectory "backend\storage\app" "Laravel storage app directory"
    Test-RequiredDirectory "backend\storage\app\private" "Private storage directory"
    Test-RequiredDirectory "backend\storage\app\public" "Public storage directory"
    Test-RequiredDirectory "backend\storage\logs" "Log directory"
    Test-RequiredDirectory "backend\bootstrap\cache" "Bootstrap cache directory"

    $backupDir = Join-Path $ProjectRoot "backend\storage\app\private\backups"
    if (Test-Path -LiteralPath $backupDir -PathType Container) {
        Add-Pass "Backup directory exists and must be preserved"
    } else {
        Add-Warning "Backup directory is not present yet. Confirm backups are configured before updating a real server."
    }
}

function Test-UpdateDocs {
    Test-RequiredFile "docs\manuales\MANUAL_ACTUALIZACION_SEGURA.md" "Safe update manual"
    Test-RequiredFile "docs\manuales\CHECKLIST_ACTUALIZACION_SEGURA.md" "Safe update checklist"
    Test-RequiredFile "docs\BACKUP_RESTORE.md" "Backup/restore manual"
    Test-RequiredFile "docs\INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md" "Institutional receipt validation guide"
}

function Test-CriticalScripts {
    Test-RequiredFile "scripts\restore_hospital_windows.ps1" "Restore self-test script"
    Test-RequiredFile "scripts\install_backup_tasks_windows.ps1" "Backup task installer"
    Test-RequiredFile "scripts\production_readiness_preflight.ps1" "Production preflight"
    Test-RequiredFile "scripts\update_release_preflight.ps1" "Update preflight"
    Test-RequiredFile "scripts\validate_restore_mysql.sh" "Disposable MySQL restore validator"
}

function Test-OperationalScriptSafety {
    $operationalScripts = @(
        "scripts\deploy_hospital_lan.ps1",
        "scripts\release_setup.bat",
        "scripts\start_hospital_services.ps1",
        "scripts\run_backup_worker.cmd",
        "scripts\run_scheduled_backup.cmd"
    )

    $unsafePattern = "(?i)(migrate:fresh|db:wipe|migrate:reset|DROP\s+DATABASE|docker\s+volume\s+rm|Remove-Item\s+.*backend\\storage|Remove-Item\s+.*storage)"
    foreach ($relative in $operationalScripts) {
        $path = Join-Path $ProjectRoot $relative
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            continue
        }

        $content = Get-Content -LiteralPath $path -Raw
        if ($content -match $unsafePattern) {
            Add-Failure "Operational update script contains destructive pattern: $relative"
        } else {
            Add-Pass "No destructive update pattern found in $relative"
        }
    }
}

function Write-ReportIfRequested {
    if ([string]::IsNullOrWhiteSpace($ReportPath)) {
        return
    }

    if ($ReportPath -notmatch '(?i)^qa[\\/].+\.md$' -or $ReportPath -match '(^|[\\/])\.\.([\\/]|$)') {
        Add-Failure "ReportPath must be a Markdown file under qa/ without traversal."
        return
    }

    $absoluteReportPath = Join-Path $ProjectRoot $ReportPath
    $reportDir = Split-Path -Parent $absoluteReportPath
    if (-not (Test-Path -LiteralPath $reportDir)) {
        New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    }

    $result = if ($failures.Count -eq 0) { "PASSED" } else { "FAILED" }
    $lines = @(
        "# Safe update preflight evidence",
        "",
        "- Generated at: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))",
        "- Project root: %PROJECT_ROOT%",
        "- Expected current commit: $ExpectedCurrentCommit",
        "- Expected target commit: $ExpectedTargetCommit",
        "- Result: $result",
        "",
        "## Passes"
    )
    foreach ($item in $passes) { $lines += "- $item" }
    $lines += ""
    $lines += "## Warnings"
    if ($warnings.Count -eq 0) { $lines += "- None" } else { foreach ($item in $warnings) { $lines += "- $item" } }
    $lines += ""
    $lines += "## Failures"
    if ($failures.Count -eq 0) { $lines += "- None" } else { foreach ($item in $failures) { $lines += "- $item" } }
    $lines += ""
    $lines += "No database, storage or production data was modified by this preflight."

    Set-Content -LiteralPath $absoluteReportPath -Value $lines -Encoding ASCII
    Add-Pass "Report written to $ReportPath"
}

Write-Host "Safe update preflight"
Write-Host "Project root: $(Protect-UpdateText $ProjectRoot)"
Write-Host "This script is read-only except optional Markdown evidence under qa/."

Test-GitState
Test-EnvProtection
Test-StorageProtection
Test-UpdateDocs
Test-CriticalScripts
Test-OperationalScriptSafety
Write-ReportIfRequested

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "SAFE_UPDATE_PREFLIGHT_FAILED: $($failures.Count) blocking issue(s)" -ForegroundColor Red
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Host "SAFE_UPDATE_PREFLIGHT_PASSED_WITH_WARNINGS: $($warnings.Count) warning(s)" -ForegroundColor Yellow
    exit 0
}

Write-Host "SAFE_UPDATE_PREFLIGHT_PASSED" -ForegroundColor Green
