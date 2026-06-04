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
$ciWorkflow = Read-RequiredFile ".github\workflows\ci.yml"
$coverageTest = Read-RequiredFile "backend\tests\Coverage\CriticalModulesCoverageTest.php"
$newInvoiceGuard = Read-RequiredFile "scripts\validate_new_invoice_maintainability.ps1"
$newInvoiceView = Read-RequiredFile "frontend\src\features\invoices\NewInvoiceView.tsx"
$schemaReferencePath = Join-Path $ProjectRoot "database\_reference_DO_NOT_EXECUTE\schema_extensions_for_barcode_reports.sql"
$schemaExecutablePath = Join-Path $ProjectRoot "database\schema_extensions_for_barcode_reports.sql"

if ($knownLimitations -ne "") {
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Deprecacion de `install_hospital_os\.ps1`\*\*' "Known limitations no longer lists legacy installer deprecation as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*IP detection robusta\*\*' "Known limitations no longer lists robust IP detection as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*`database/schema_extensions_for_barcode_reports\.sql`\*\*' "Known limitations no longer lists barcode/report SQL relocation as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*CSP report channel opcional\*\*' "Known limitations no longer lists CSP report channel as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Comando `hospital:maintenance`\*\*' "Known limitations no longer lists maintenance command as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Auditoria de cambios de permisos\*\*' "Known limitations no longer lists permission audit as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Rate limit por usuario\*\*' "Known limitations no longer lists per-user rate limit as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Cobertura >80% en modulos criticos\*\*' "Known limitations no longer lists critical coverage gate as pending"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*NewInvoiceView refactor\*\*' "Known limitations no longer lists NewInvoiceView refactor as pending"

    foreach ($closedItem in @(
        'Installer legacy compatibility guarded',
        'LAN/IP recovery guarded',
        'Barcode/report SQL reference isolated',
        'CSP report channel implemented',
        'Maintenance mode guarded',
        'Permission audit guarded',
        'Per-user rate limit guarded',
        'Cobertura >80% en modulos criticos',
        'NewInvoiceView refactor'
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

if ($ciWorkflow -ne "" -and $coverageTest -ne "") {
    Test-Contains $ciWorkflow 'coverage:\s*pcov' "CI installs a coverage driver for backend jobs"
    Test-Contains $ciWorkflow 'HOSPITAL_REQUIRE_COVERAGE:\s*''1''' "CI requires the critical coverage gate"
    Test-Contains $ciWorkflow 'vendor/bin/phpunit -c phpunit\.coverage\.xml' "CI invokes the coverage phpunit profile"
    Test-Contains $coverageTest 'COVERAGE_THRESHOLD = 80\.0' "Critical coverage test enforces the 80 percent threshold"
    foreach ($criticalModule in @('Billing', 'Cash', 'Payments', 'Backups', 'Receipts')) {
        Test-Contains $coverageTest ([regex]::Escape("'$criticalModule'")) "Critical coverage test includes module: $criticalModule"
    }
}

if ($newInvoiceGuard -ne "" -and $newInvoiceView -ne "") {
    Test-Contains $newInvoiceGuard 'NEW_INVOICE_MAINTAINABILITY: YES' "NewInvoice maintainability guard reports a stable result marker"
    Test-Contains $newInvoiceGuard 'NewInvoiceView stays under 200 lines' "NewInvoice maintainability guard enforces the view size limit"
    Test-Contains $newInvoiceGuard 'useInvoiceLifecycle' "NewInvoice maintainability guard checks invoice lifecycle extraction"
    $newInvoiceFullPath = Join-Path $ProjectRoot "frontend\src\features\invoices\NewInvoiceView.tsx"
    $newInvoiceLineCount = (Get-Content -LiteralPath $newInvoiceFullPath | Measure-Object -Line).Lines
    if ($newInvoiceLineCount -le 200) {
        Add-Pass "NewInvoiceView source is currently under 200 lines ($newInvoiceLineCount)"
    } else {
        Add-Failure "NewInvoiceView source is currently $newInvoiceLineCount lines; expected <= 200."
    }
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
