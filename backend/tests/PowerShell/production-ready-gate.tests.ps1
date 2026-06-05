param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$validator = Join-Path $ProjectRoot "scripts\validate_production_ready_gate_safety.ps1"
if (-not (Test-Path -LiteralPath $validator -PathType Leaf)) {
    Write-Host "PRODUCTION_READY_GATE_TESTS: NO (missing validator)" -ForegroundColor Red
    exit 1
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $validator -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
    Write-Host "PRODUCTION_READY_GATE_TESTS: NO" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "PRODUCTION_READY_GATE_TESTS: YES" -ForegroundColor Green
