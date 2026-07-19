$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "production_readiness_preflight.ps1"
$content = Get-Content -LiteralPath $scriptPath -Raw
$lanClientPath = Join-Path $PSScriptRoot "validate_lan_client.ps1"
$lanClientContent = Get-Content -LiteralPath $lanClientPath -Raw
$operationalUrlSafetyPath = Join-Path $PSScriptRoot "lib\operational_url_safety.ps1"

if (-not (Test-Path -LiteralPath $operationalUrlSafetyPath -PathType Leaf)) {
    throw "Expected shared operational URL safety library: $operationalUrlSafetyPath"
}

function Assert-Contains([string] $needle) {
    if (-not $content.Contains($needle)) {
        throw "Expected production preflight to contain: $needle"
    }
}

function Assert-NotContains([string] $needle) {
    if ($content.Contains($needle)) {
        throw "Expected production preflight not to contain: $needle"
    }
}

function Assert-LanClientContains([string] $needle) {
    if (-not $lanClientContent.Contains($needle)) {
        throw "Expected LAN client validator to contain: $needle"
    }
}

function Assert-LanClientNotContains([string] $needle) {
    if ($lanClientContent.Contains($needle)) {
        throw "Expected LAN client validator not to contain: $needle"
    }
}

Assert-Contains "qa\LOCAL_SERVER_VALIDATION_PROOF.md"
Assert-Contains "local server browser"
Assert-Contains "BaseUrl uses loopback; validating single-machine local mode"
Assert-NotContains "BaseUrl must be the final LAN IP or local domain, not localhost"
Assert-Contains "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
Assert-Contains "primary institutional receipt printer"
Assert-Contains "Media carta result"
Assert-Contains "Carta result"
Assert-Contains "A5 result"
Assert-Contains "Media carta"
Assert-Contains "Carta"
Assert-Contains "A5"
Assert-NotContains "qa\THERMAL_PRINTER_PROOF.md"
Assert-NotContains "80mm result"
Assert-NotContains "58mm result"
Assert-Contains '[string] $EnvFile = ""'
Assert-Contains '[ValidateSet("Auto", "Docker", "WindowsTasks")]'
Assert-Contains '[string] $DockerProject = ""'
Assert-Contains 'Test-DockerRuntimeServices'
Assert-Contains 'Read-DockerRuntimeEnv'
Assert-Contains 'Join-Path $ProjectRoot ".env"'
Assert-Contains '@("mysql", "backend", "nginx", "queue-worker", "realtime-worker", "scheduler")'
Assert-Contains 'Docker runtime service ''$requiredService'' is running'
Assert-Contains 'function Test-ServedFrontendBuild'
Assert-Contains 'Test-ServedFrontendBuild $BaseUrl'
Assert-Contains 'PUSHER_CLIENT_PORT'
Assert-Contains 'Invoke-WebSocketHandshake $pusherClientHost $pusherClientPort $pusherClientScheme $pusherAppKey'
Assert-Contains 'CloseOutputAsync'
Assert-NotContains '.CloseAsync('
Assert-LanClientContains 'CloseOutputAsync'
Assert-LanClientNotContains '.CloseAsync('
Assert-LanClientContains 'SOKETI_PORT'
Assert-LanClientContains 'New-WebSocketCheckResult $pusherClientHost $pusherClientPort $pusherClientScheme $pusherAppKey'

Write-Host "[ OK ] production readiness preflight requires receipt proof and validates Docker workers"
