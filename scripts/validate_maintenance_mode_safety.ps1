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

$command = Read-RequiredFile "backend\app\Console\Commands\MaintenanceCommand.php"
$test = Read-RequiredFile "backend\tests\Feature\MaintenanceModeTest.php"
$bootstrap = Read-RequiredFile "backend\bootstrap\app.php"
$view = Read-RequiredFile "backend\resources\views\maintenance.blade.php"
$operatorIndex = Read-RequiredFile "docs\manuales\INDICE_OPERADOR.md"
$knownLimitations = Read-RequiredFile "docs\KNOWN_LIMITATIONS.md"
$operativeNotes = Read-RequiredFile "docs\OPERATIVE_NOTES_2026_06_02.md"
$decisionLog = Read-RequiredFile "docs\DECISIONS.md"

if ($command -ne "") {
    Test-Contains $command 'hospital:maintenance' "Maintenance command is registered"
    Test-Contains $command '\{action : on or off\}' "Maintenance command requires explicit on/off action"
    Test-Contains $command '\{--message=' "Maintenance command supports operator-facing message"
    Test-Contains $command 'storagePath\(' "Maintenance command writes Laravel maintenance flag only"
    Test-Contains $command "'status'\s*=>\s*503" "Maintenance payload uses 503 status"
    Test-Contains $command "'retry'\s*=>\s*60" "Maintenance payload keeps short retry guidance"
    Test-Contains $command 'json_encode\(\$payload,\s*JSON_THROW_ON_ERROR\)' "Maintenance payload is structured JSON"
    Test-Contains $command '\$files->delete\(\$maintenanceFile\)' "Maintenance off removes only the maintenance flag"
    Test-DoesNotContain $command '(?i)migrate:fresh|db:wipe|DROP\s+DATABASE|TRUNCATE\s+TABLE|docker\s+compose\s+down\s+-v|Remove-Item' "Maintenance command avoids destructive operations"
    Test-DoesNotContain $command '(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+' "Maintenance command does not embed secret-like assignments"
}

if ($test -ne "") {
    Test-Contains $test 'test_maintenance_command_writes_and_removes_safe_payload' "Maintenance command payload has feature test"
    Test-Contains $test 'test_html_maintenance_page_uses_human_spanish_copy' "HTML maintenance page has feature test"
    Test-Contains $test 'test_api_maintenance_response_uses_human_json_without_details' "API maintenance JSON has feature test"
    Test-Contains $test 'assertArrayNotHasKey\(' "Maintenance test checks payload omits secrets"
    Test-Contains $test 'assertDontSee\(.*framework/down' "Maintenance test hides internal down-file path"
    Test-Contains $test ([regex]::Escape("assertDontSee('Ã'")) "Maintenance test rejects mojibake"
}

if ($bootstrap -ne "") {
    Test-Contains $bootstrap 'Sistema en mantenimiento\. Vuelva a intentar en unos minutos\.' "API maintenance response is human-readable"
    Test-Contains $bootstrap ([regex]::Escape("response()->view('maintenance'")) "HTML maintenance response uses institutional view"
    Test-DoesNotContain $bootstrap '(?i)APP_KEY|DB_PASSWORD|framework/down.*json' "Maintenance exception handler avoids exposing secrets/raw paths"
}

if ($view -ne "") {
    Test-Contains $view '<html lang="es">' "Maintenance view declares Spanish language"
    Test-Contains $view 'Sistema en mantenimiento' "Maintenance view has human heading"
    Test-Contains $view 'supervisor del hospital' "Maintenance view tells staff who to contact"
    Test-DoesNotContain $view '(?i)APP_KEY|DB_PASSWORD|storage/framework/down|stack trace|exception' "Maintenance view avoids technical details"
}

if ($operatorIndex -ne "") {
    Test-Contains $operatorIndex 'hospital:maintenance on' "Operator index documents enabling maintenance mode"
    Test-Contains $operatorIndex 'hospital:maintenance off' "Operator index documents disabling maintenance mode"
    Test-Contains $operatorIndex 'Sistema en mantenimiento' "Operator index explains maintenance message"
}

if ($knownLimitations -ne "") {
    Test-Contains $knownLimitations 'Maintenance mode guarded' "Known limitations records maintenance as closed"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Comando `hospital:maintenance`\*\*' "Known limitations no longer lists maintenance command as pending"
}

if ($operativeNotes -ne "") {
    Test-Contains $operativeNotes 'hospital:maintenance[\s\S]*incidentes\s+supervisados|Comando `hospital:maintenance` interactivo' "Operative notes record maintenance mode status"
}

if ($decisionLog -ne "") {
    Test-Contains $decisionLog 'hospital:maintenance' "Decision log records maintenance command decision"
    Test-Contains $decisionLog 'no guarda secretos ni bypass' "Decision log records maintenance safety invariant"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "MAINTENANCE_MODE_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "MAINTENANCE_MODE_SAFETY: YES" -ForegroundColor Green
