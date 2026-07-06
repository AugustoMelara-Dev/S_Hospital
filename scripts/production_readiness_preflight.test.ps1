$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "production_readiness_preflight.ps1"
$content = Get-Content -LiteralPath $scriptPath -Raw

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

Write-Host "[ OK ] production readiness preflight requires institutional receipt proof"