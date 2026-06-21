param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path -LiteralPath $Root).Path
$runnerPath = Join-Path $Root 'frontend\scripts\run-release-e2e.mjs'
$qualityGatePath = Join-Path $Root 'scripts\quality_gate_windows.ps1'

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Require-Content([string] $content, [string] $pattern, [string] $label) {
    if ($content -notmatch $pattern) {
        Add-Failure $label
        return
    }

    Add-Pass $label
}

function Forbid-Content([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Failure $label
        return
    }

    Add-Pass $label
}

if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
    Add-Failure "Release E2E runner missing at $runnerPath"
    Write-Host ''
    Write-Host "RELEASE_E2E_GOLDEN_SQLITE_SAFETY: NO ($($failures.Count) issue(s))" -ForegroundColor Red
    exit 1
}

$runner = Get-Content -LiteralPath $runnerPath -Raw
$qualityGate = Get-Content -LiteralPath $qualityGatePath -Raw

Require-Content $runner 'e2e-golden-' 'Runner names reusable E2E golden SQLite databases by hash'
Require-Content $runner 'e2e-release-' 'Runner creates per-run disposable SQLite databases by process id'
Require-Content $runner 'function\s+computeMigrationHash' 'Runner computes an E2E migration hash'
Require-Content $runner 'database'', ''migrations' 'Runner hashes migrations'
Require-Content $runner 'database'', ''seeders' 'Runner hashes seeders'
Require-Content $runner 'copyFileSync' 'Runner clones the golden SQLite database for each run'
Require-Content $runner 'prepareGoldenDatabase' 'Runner materializes golden SQLite database when hash is missing'
Require-Content $runner 'hospital:prepare-e2e-release-data' 'Golden materialization prepares E2E release seed data'
Require-Content $runner 'APP_ENV:\s*''testing''' 'Runner forces APP_ENV testing'
Require-Content $runner 'DB_CONNECTION:\s*''sqlite''' 'Runner forces SQLite only for E2E release automation'
Forbid-Content $runner "run\('php', \['artisan', 'migrate:fresh'" 'Runner no longer runs migrate:fresh directly against the per-run database'
Forbid-Content $runner 'docker\s+compose\s+down\s+-v|db:wipe|migrate:reset' 'Runner has no destructive Docker/database reset commands'
Require-Content $runner 'release-e2e-playwright\.json' 'Runner reads Playwright release JSON results'
Require-Content $runner 'writeReleaseSummaryReport' 'Runner consolidates release E2E human summary after Playwright'
Require-Content $runner 'playwright_summary' 'Release E2E report includes Playwright aggregate stats'
Require-Content $qualityGate 'test_release_e2e_golden_sqlite_safety\.ps1' 'Windows quality gate explicitly runs release E2E golden SQLite safety'

Write-Host ''
if ($failures.Count -gt 0) {
    Write-Host "RELEASE_E2E_GOLDEN_SQLITE_SAFETY: NO ($($failures.Count) issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host 'RELEASE_E2E_GOLDEN_SQLITE_SAFETY: YES' -ForegroundColor Green
