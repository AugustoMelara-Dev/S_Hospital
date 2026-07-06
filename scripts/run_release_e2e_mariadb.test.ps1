$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "run_release_e2e_mariadb.ps1"
$content = Get-Content -LiteralPath $scriptPath -Raw

function Assert-Contains([string] $needle) {
    if (-not $content.Contains($needle)) {
        throw "Expected MariaDB release E2E script to contain: $needle"
    }
}

function Assert-NotContains([string] $needle) {
    if ($content.Contains($needle)) {
        throw "Expected MariaDB release E2E script not to contain: $needle"
    }
}

Assert-Contains "The E2E seed password must be provided via -SeedPassword"
Assert-Contains "hospital:prepare-e2e-release-data"
Assert-Contains "--password=<hidden>"
Assert-Contains "E2E_RELEASE_ALLOW_MUTATIONS=1"
Assert-Contains "E2E_RELEASE_BASE_URL="
Assert-Contains "E2E_RELEASE_API_BASE_URL="
Assert-Contains "E2E_RELEASE_REPORT_PATH="
Assert-Contains "mariadb-release-e2e-report.json"
Assert-Contains "E2E_RELEASE_PASSWORD=<hidden>"
Assert-Contains "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="
Assert-Contains "--config=playwright.release.config.ts"
Assert-Contains "Check container Chromium executable"
Assert-NotContains "Password123"
Assert-NotContains "--json"
Assert-NotContains "APP_ENV=production"

Write-Host "[ OK ] MariaDB release E2E script requires explicit credentials and container Playwright settings"
