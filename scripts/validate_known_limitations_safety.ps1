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

    Add-Failure "Missing required file: $relativePath"
    return ""
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

$knownLimitations = Read-RequiredFile "docs\KNOWN_LIMITATIONS.md"
$installerEvidence = Read-RequiredFile "qa\INSTALLER_LEGACY_SAFETY_2026_06_03.md"
$lanEvidence = Read-RequiredFile "qa\LAN_RECOVERY_SAFETY_2026_06_03.md"
$netDiagnostics = Read-RequiredFile "scripts\lib\net_diagnostics.ps1"
$handoff = Read-RequiredFile "qa\FINAL_PRODUCTION_HANDOFF_RESULT.md"
$cspTest = Read-RequiredFile "backend\tests\Feature\CspReportControllerTest.php"
$cspController = Read-RequiredFile "backend\app\Http\Controllers\CspReportController.php"
$schemaReferencePath = Join-Path $ProjectRoot "database\_reference_DO_NOT_EXECUTE\schema_extensions_for_barcode_reports.sql"
$schemaExecutablePath = Join-Path $ProjectRoot "database\schema_extensions_for_barcode_reports.sql"

if ($knownLimitations -ne "") {
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Deprecacion de `install_hospital_os\.ps1`\*\*' "Known limitations no longer lists legacy installer deprecation as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*IP detection robusta\*\*' "Known limitations no longer lists robust IP detection as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*`database/schema_extensions_for_barcode_reports\.sql`\*\*' "Known limitations no longer lists barcode/report SQL relocation as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*CSP report channel opcional\*\*' "Known limitations no longer lists CSP report channel as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Comando `hospital:maintenance`\*\*' "Known limitations no longer lists maintenance command as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Auditoria de cambios de permisos\*\*' "Known limitations no longer lists permission audit as pending"

    foreach ($closedItem in @(
        'Installer legacy compatibility guarded',
        'LAN/IP recovery guarded',
        'Barcode/report SQL reference isolated',
        'CSP report channel implemented',
        'Maintenance mode guarded',
        'Permission audit guarded'
    )) {
        Test-Contains $knownLimitations ([regex]::Escape($closedItem)) "Known limitations records closed item: $closedItem"
    }

    foreach ($finalBlocker in @(
        'LAN client validation',
        'Impresora fisica',
        'Restore real final',
        'Concurrencia final',
        'Worker continuo de backups',
        'SistemaCajaHospitalaria-StackAutostart',
        'Handoff final'
    )) {
        Test-Contains $knownLimitations ([regex]::Escape($finalBlocker)) "Known limitations preserves final blocker: $finalBlocker"
    }
}

if ($installerEvidence -ne "") {
    Test-Contains $installerEvidence 'INSTALLER_LEGACY_SAFETY: YES' "Installer legacy evidence passes"
}

if ($lanEvidence -ne "") {
    Test-Contains $lanEvidence 'LAN_RECOVERY_SAFETY: YES' "LAN recovery evidence passes"
    Test-Contains $lanEvidence 'Get-NetRoute.*route metrics|route metrics.*Get-NetRoute' "LAN evidence covers route metric based IP selection"
}

if ($netDiagnostics -ne "") {
    Test-Contains $netDiagnostics 'Get-NetRoute' "Network diagnostics use Get-NetRoute"
    Test-Contains $netDiagnostics 'RouteMetric' "Network diagnostics sort LAN candidates by route metric"
}

if ($handoff -ne "") {
    Test-Contains $handoff 'PRODUCTION_CANDIDATE' "Handoff stays production candidate"
    Test-Contains $handoff 'SistemaCajaHospitalaria-StackAutostart' "Handoff preserves stack autostart final-server blocker"
}

if (Test-Path -LiteralPath $schemaReferencePath -PathType Leaf) {
    Add-Pass "Barcode/report SQL reference is isolated under database\_reference_DO_NOT_EXECUTE"
} else {
    Add-Failure "Barcode/report SQL reference is not isolated under database\_reference_DO_NOT_EXECUTE"
}

if (Test-Path -LiteralPath $schemaExecutablePath -PathType Leaf) {
    Add-Failure "Executable database\schema_extensions_for_barcode_reports.sql still exists at root database path"
} else {
    Add-Pass "No executable barcode/report SQL extension remains at database root"
}

if ($cspTest -ne "" -and $cspController -ne "") {
    Test-Contains $cspTest '/api/system/csp-report' "CSP report route is covered by feature test"
    Test-Contains $cspTest 'throttle:30,1' "CSP report route keeps rate limit test"
    Test-Contains $cspController 'Log::info\(' "CSP report controller records reports for support"
}

if ($knownLimitations -match '(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+') {
    Add-Failure "Known limitations contains a secret-like assignment."
} else {
    Add-Pass "Known limitations does not expose secret-like assignments"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "KNOWN_LIMITATIONS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "KNOWN_LIMITATIONS_SAFETY: YES" -ForegroundColor Green
