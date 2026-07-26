$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "run_release_e2e_mariadb.ps1"
$content = Get-Content -LiteralPath $scriptPath -Raw
$drillPath = Join-Path $PSScriptRoot 'lib\recovery_release_drill.ps1'
$drillContent = Get-Content -LiteralPath $drillPath -Raw

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

function Assert-DrillContains([string] $needle) {
    if (-not $drillContent.Contains($needle)) {
        throw "Expected recovery drill module to contain: $needle"
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
Assert-DrillContains "--json"
Assert-NotContains "APP_ENV=production"

Assert-Contains '[switch] $RecoveryDrill'
Assert-Contains "s_hospital_recovery_"
Assert-Contains "RecoverySourceDatabase"
Assert-Contains "RecoveryTargetDatabase"
Assert-Contains "ConfiguredProductionDatabase"
Assert-Contains "RECOVERY_CERTIFICATION"
Assert-DrillContains "function Test-RecoveryDrillIsolation"
Assert-DrillContains "refuses the configured production database"
Assert-DrillContains "rollback_succeeded"

. $drillPath

$allowed = Test-RecoveryDrillIsolation `
    -ComposeProject 's_hospital_recovery_contract1' `
    -SourceDatabase 'hospital_recovery_source_contract1' `
    -TargetDatabase 'hospital_recovery_target_contract1' `
    -ConfiguredProductionDatabase 'hospital_billing' `
    -EvidencePath 'qa\RECOVERY_CERTIFICATION.md'
if (-not $allowed.Allowed) {
    throw "Expected isolated recovery drill names to be allowed: $($allowed.Blockers -join '; ')"
}

$productionCollision = Test-RecoveryDrillIsolation `
    -ComposeProject 's_hospital_recovery_contract2' `
    -SourceDatabase 'hospital_recovery_source_contract2' `
    -TargetDatabase 'hospital_billing' `
    -ConfiguredProductionDatabase 'hospital_billing' `
    -EvidencePath 'qa\RECOVERY_CERTIFICATION.md'
if ($productionCollision.Allowed -or ($productionCollision.Blockers -join ' ') -notmatch 'refuses the configured production database') {
    throw 'Expected configured production database collision to be blocked.'
}

$unsafeProject = Test-RecoveryDrillIsolation `
    -ComposeProject 's_hospital' `
    -SourceDatabase 'hospital_recovery_source_contract3' `
    -TargetDatabase 'hospital_recovery_target_contract3' `
    -ConfiguredProductionDatabase 'hospital_billing' `
    -EvidencePath 'qa\RECOVERY_CERTIFICATION.md'
if ($unsafeProject.Allowed) {
    throw 'Expected non-isolated Compose project to be blocked.'
}

Write-Host "[ OK ] MariaDB release E2E script requires explicit credentials and container Playwright settings"
