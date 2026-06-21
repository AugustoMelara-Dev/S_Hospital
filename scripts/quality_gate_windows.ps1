param(
    [string] $ProjectRoot = "",
    [switch] $CriticalOnly,
    [switch] $Full,
    [switch] $SkipOps,
    [switch] $SkipBackend,
    [switch] $SkipFrontend
)

$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

if (-not $CriticalOnly -and -not $Full) {
    $CriticalOnly = $true
}

$failures = New-Object System.Collections.Generic.List[string]

function Invoke-GateStep([string] $Name, [string] $WorkingDirectory, [scriptblock] $Command) {
    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) {
            throw "Exit code $LASTEXITCODE"
        }
        Write-Host "[OK] $Name" -ForegroundColor Green
    } catch {
        $failures.Add("${Name}: $($_.Exception.Message)") | Out-Null
        Write-Host "[FAIL] ${Name}: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

function Test-PathOrFail([string] $Path, [string] $Label) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label not found at $Path"
    }
}

$backendDir = Join-Path $ProjectRoot "backend"
$frontendDir = Join-Path $ProjectRoot "frontend"
$installerSafetyScript = Join-Path $ProjectRoot "scripts\validate_installer_safety.ps1"
$releaseE2eGoldenSqliteSafetyScript = Join-Path $ProjectRoot "scripts\test_release_e2e_golden_sqlite_safety.ps1"
$goldenDbRunnerSafetyScript = Join-Path $ProjectRoot "scripts\test_golden_db_runner_safety.ps1"

Write-Host "Windows quality gate"
Write-Host "Project root: $ProjectRoot"
Write-Host "Mode: $(if ($Full) { 'Full' } else { 'CriticalOnly' })"

Invoke-GateStep "git diff check" $ProjectRoot { git diff --check }

if (-not $SkipOps) {
    Test-PathOrFail $installerSafetyScript "Installer safety script"
    Invoke-GateStep "ops scripts safety" $ProjectRoot {
        & $installerSafetyScript -Root $ProjectRoot
    }

    Test-PathOrFail $releaseE2eGoldenSqliteSafetyScript "Release E2E golden SQLite safety script"
    Invoke-GateStep "release e2e golden sqlite safety" $ProjectRoot {
        & $releaseE2eGoldenSqliteSafetyScript -Root $ProjectRoot
    }
}

if (-not $SkipBackend) {
    Test-PathOrFail $goldenDbRunnerSafetyScript "Golden DB runner safety script"
    Invoke-GateStep "golden db runner safety" $ProjectRoot {
        & $goldenDbRunnerSafetyScript -Root $ProjectRoot
    }

    Test-PathOrFail (Join-Path $backendDir "artisan") "Laravel artisan"
    Test-PathOrFail (Join-Path $backendDir "vendor\autoload.php") "Composer autoload"

    $backendFilters = @(
        "InvoiceDialysisPrescriptionTest",
        "CashPaymentsReceiptTest",
        "InstitutionalReceiptPaymentIntegrationTest",
        "InstitutionalReceiptPdfTest",
        "BackupWorkflowTest",
        "RoleManagementTest",
        "UserManagementTest",
        "AuthorizationStrategyTest"
    )

    foreach ($filter in $backendFilters) {
        Invoke-GateStep "backend test $filter" $backendDir {
            php -d memory_limit=512M artisan test --colors=never --filter=$filter
        }
    }

    if ($Full) {
        Invoke-GateStep "backend full phpunit" $backendDir {
            php -d memory_limit=512M artisan test --colors=never
        }
    }

    Invoke-GateStep "backend pint" $backendDir { .\vendor\bin\pint --test }
    Invoke-GateStep "backend phpstan" $backendDir { .\vendor\bin\phpstan analyse --memory-limit=1G --no-progress }
}

if (-not $SkipFrontend) {
    Test-PathOrFail (Join-Path $frontendDir "package.json") "Frontend package.json"
    Test-PathOrFail (Join-Path $frontendDir "node_modules\.bin\vitest.cmd") "Vitest binary"

    Invoke-GateStep "frontend critical tests" $frontendDir { npm.cmd run test:critical }

    if ($Full) {
        Invoke-GateStep "frontend full tests windows" $frontendDir { npm.cmd run test:full:windows }
    }

    Invoke-GateStep "frontend typecheck" $frontendDir { npm.cmd run typecheck }
    Invoke-GateStep "frontend lint" $frontendDir { npm.cmd run lint }
    Invoke-GateStep "frontend build" $frontendDir { npm.cmd run build }
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "WINDOWS_QUALITY_GATE_FAILED" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "- $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "WINDOWS_QUALITY_GATE_PASSED" -ForegroundColor Green
