$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$projectRoot = Split-Path -Parent $scriptRoot

function Assert-Contains([string] $Path, [string] $Needle, [string] $Message) {
    $content = Get-Content -LiteralPath $Path -Raw
    if (-not $content.Contains($Needle)) {
        throw $Message
    }
}

function Assert-NotContains([string] $Path, [string] $Needle, [string] $Message) {
    $content = Get-Content -LiteralPath $Path -Raw
    if ($content.Contains($Needle)) {
        throw $Message
    }
}

$composePath = Join-Path $projectRoot "docker-compose.prod.yml"
$deployPath = Join-Path $scriptRoot "deploy_hospital_lan.ps1"
$refreshPath = Join-Path $scriptRoot "refresh_lan_ip.ps1"

Assert-Contains $composePath 'APP_URL: ${APP_SCHEME:-http}://' "docker-compose.prod.yml debe derivar APP_URL de APP_SCHEME."
Assert-Contains $composePath 'SESSION_SECURE_COOKIE: ${SESSION_SECURE_COOKIE:-false}' "docker-compose.prod.yml debe exponer SESSION_SECURE_COOKIE."
Assert-Contains $composePath '${SOKETI_BIND_IP:-0.0.0.0}:${SOKETI_PORT:-6001}:6001' "Soketi debe poder publicarse en LAN de forma explicita."
Assert-NotContains $composePath '127.0.0.1:${SOKETI_PORT:-6001}:6001' "Soketi no debe quedar limitado a localhost si los clientes usan SERVER_IP."

Assert-Contains $deployPath 'profile=private remoteip=localsubnet' "deploy_hospital_lan.ps1 debe limitar firewall a red privada/subnet local."
Assert-Contains $deployPath 'S_Hospital Soketi LAN Port 6001' "deploy_hospital_lan.ps1 debe abrir Soketi de forma explicita para LAN."
Assert-Contains $refreshPath '-RemoteAddress LocalSubnet' "refresh_lan_ip.ps1 debe limitar firewall a LocalSubnet."
Assert-Contains $refreshPath 'Sistema Caja Hospitalaria - Soketi LAN TCP 6001' "refresh_lan_ip.ps1 debe recrear regla Soketi LAN."

Write-Host "[OK] LAN deploy hardening validation passed."
