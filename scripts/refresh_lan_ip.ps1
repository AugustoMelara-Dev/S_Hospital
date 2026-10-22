<#
.SYNOPSIS
  Re-applies the current host LAN IP to all the places it is
  baked into: backend/.env (APP_URL, SERVER_IP, SANCTUM_STATEFUL
  _DOMAINS, CORS_ALLOWED_ORIGINS), root .env (SERVER_IP), the
  Windows firewall rule, and the nginx default.conf.

.DESCRIPTION
  After a DHCP lease change, a NIC swap, a VM migration, or
  a new corporate firewall the server's IP can change. Without
  this refresh, every cashier on a different PC gets a CORS
  error or a 419 CSRF mismatch the next time the IP changes.

  This script:
   1. Detects the current best LAN IPv4 (Get-LanIPv4Candidates).
   2. Replaces SERVER_IP in both .env files.
   3. Updates SANCTUM_STATEFUL_DOMAINS and CORS_ALLOWED_ORIGINS
      in backend/.env to include the new IP (and :APP_PORT form).
   4. Updates APP_URL in backend/.env.
   5. Re-creates the Windows firewall inbound rule on APP_PORT.
   6. Re-runs the docker compose stack so the env changes take
      effect.
   7. Restarts the scheduler and queue-worker so the heartbeat
      tick picks up the new IP.

  Use -WhatIf to preview all changes without applying them.

  MODO TLS (overlay docker-compose.tls.yml): si HOSPITAL_TLS_ORIGIN
  esta definido en el .env raiz, el certificado del servidor lleva
  la IP de la LAN como SAN IP y HOSPITAL_TLS_ORIGIN embebe el
  origen anterior. Cambiar la IP exige re-emitir el certificado
  (generate_local_ca.ps1 -Force) y actualizar HOSPITAL_TLS_ORIGIN.
  Este script es HTTP-only: lo advierte pero no lo ejecuta.

.PARAMETER ProjectRoot
  Absolute path to the project root. Defaults to the parent of
  the scripts folder.

.PARAMETER ServerIp
  Force a specific IP. If omitted, the script picks the best
  candidate (highest metric LAN interface).

.PARAMETER AppPort
  Override APP_PORT (default 8000).

.PARAMETER WhatIf
  Print every change that WOULD be made without applying it.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $ProjectRoot,
    [string] $ServerIp,
    [int] $AppPort = 0
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$rootEnv = Join-Path $ProjectRoot ".env"
$backendEnv = Join-Path $ProjectRoot "backend/.env"

if (-not (Test-Path -LiteralPath $rootEnv)) {
    Write-Error "Root .env not found: $rootEnv"
    exit 2
}
if (-not (Test-Path -LiteralPath $backendEnv)) {
    Write-Error "backend/.env not found: $backendEnv"
    exit 2
}

if (-not $AppPort) {
    . "$PSScriptRoot/lib/env_helpers.ps1"
    $envData = Read-EnvFile -path $backendEnv
    $existing = $envData.APP_PORT
    if ($existing) {
        $AppPort = [int] $existing
    } else {
        $AppPort = 8000
    }
}

if (-not $ServerIp) {
    . "$PSScriptRoot/lib/net_diagnostics.ps1"
    $candidates = Get-LanIPv4Candidates
    if (-not $candidates -or $candidates.Count -eq 0) {
        Write-Error "No LAN IPv4 candidate found. Pass -ServerIp 192.168.x.x explicitly."
        exit 3
    }
    $ServerIp = $candidates[0]
}

Write-Host "Refreshing LAN IP to $ServerIp (port $AppPort)..."

# TLS overlay detection: docker-compose.tls.yml is opt-in through a non-empty
# HOSPITAL_TLS_ORIGIN in the root .env. In that mode the server certificate
# carries the LAN IP as an IP SAN and HOSPITAL_TLS_ORIGIN embeds the previous
# origin, so rotating the IP requires re-issuing the certificate and updating
# the origin. This script only refreshes the HTTP wiring and must not rotate
# TLS material silently.
. "$PSScriptRoot/lib/env_helpers.ps1"
$rootEnvData = Read-EnvFile -path $rootEnv
$tlsOrigin = ''
if ($rootEnvData.ContainsKey('HOSPITAL_TLS_ORIGIN')) {
    $tlsOrigin = ([string] $rootEnvData.HOSPITAL_TLS_ORIGIN).Trim()
}
$tlsActive = $tlsOrigin -ne ''

if ($tlsActive) {
    Write-Host ""
    Write-Host "[WARN] Modo TLS activo (HOSPITAL_TLS_ORIGIN=$tlsOrigin)." -ForegroundColor Yellow
    Write-Host "       Este script solo actualiza el modo HTTP; NO re-emite el certificado." -ForegroundColor Yellow
    Write-Host "       Con TLS activo, cambiar la IP exige ademas:" -ForegroundColor Yellow
    Write-Host "         1) Re-emitir el certificado con el nuevo SAN IP (misma CA; los clientes no reinstalan):" -ForegroundColor Yellow
    Write-Host "            powershell -File scripts\generate_local_ca.ps1 -ServerIp $ServerIp [-ServerNames <los mismos>] -Force" -ForegroundColor Yellow
    Write-Host "         2) Actualizar HOSPITAL_TLS_ORIGIN en .env al origen exacto del navegador (IP nueva o el DNS de -ServerNames)." -ForegroundColor Yellow
    Write-Host "         3) Recrear el stack con el overlay:" -ForegroundColor Yellow
    Write-Host "            docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml up -d" -ForegroundColor Yellow
    Write-Host "       Sin esos pasos el navegador rechazara el certificado (SAN viejo) en https://." -ForegroundColor Yellow
    Write-Host ""
}

# Helper: replace-or-append a key in a .env file (ASCII, no BOM).
function Update-EnvKey {
    param([string]$Path, [string]$Key, [string]$Value)
    $lines = [System.Collections.Generic.List[string]]::new()
    $found = $false
    if (Test-Path -LiteralPath $Path) {
        Get-Content -LiteralPath $Path | ForEach-Object {
            $line = $_
            if ($line -match "^$([regex]::Escape($Key))=") {
                $lines.Add("$Key=$Value")
                $found = $true
            } else {
                $lines.Add($line)
            }
        }
    }
    if (-not $found) {
        $lines.Add("$Key=$Value")
    }
    Set-Content -LiteralPath $Path -Value $lines -Encoding ASCII
}

# 1. Update root .env
if ($PSCmdlet.ShouldProcess($rootEnv, "Set SERVER_IP=$ServerIp")) {
    Update-EnvKey -Path $rootEnv -Key "SERVER_IP" -Value $ServerIp
    Update-EnvKey -Path $rootEnv -Key "APP_SCHEME" -Value "http"
    Update-EnvKey -Path $rootEnv -Key "HOSPITAL_ALLOW_INSECURE_HTTP" -Value "1"
    Update-EnvKey -Path $rootEnv -Key "SESSION_SECURE_COOKIE" -Value "false"
    Write-Host "  updated $rootEnv (SERVER_IP)"
}

# 2. Update backend .env
if ($PSCmdlet.ShouldProcess($backendEnv, "Set LAN env vars")) {
    Update-EnvKey -Path $backendEnv -Key "SERVER_IP" -Value $ServerIp
    Update-EnvKey -Path $backendEnv -Key "APP_PORT" -Value $AppPort.ToString()
    Update-EnvKey -Path $backendEnv -Key "APP_SCHEME" -Value "http"
    Update-EnvKey -Path $backendEnv -Key "HOSPITAL_ALLOW_INSECURE_HTTP" -Value "1"
    Update-EnvKey -Path $backendEnv -Key "SESSION_SECURE_COOKIE" -Value "false"

    # Read existing SANCTUM_STATEFUL_DOMAINS and CORS_ALLOWED_ORIGINS
    . "$PSScriptRoot/lib/env_helpers.ps1"
    $env = Read-EnvFile -path $backendEnv
    $statefulRaw = ''
    if ($env.ContainsKey('SANCTUM_STATEFUL_DOMAINS')) { $statefulRaw = [string]$env.SANCTUM_STATEFUL_DOMAINS }
    $corsRaw = ''
    if ($env.ContainsKey('CORS_ALLOWED_ORIGINS')) { $corsRaw = [string]$env.CORS_ALLOWED_ORIGINS }
    $stateful = @() + ($statefulRaw -split ',')
    $cors = @() + ($corsRaw -split ',')

    $needHost = "$ServerIp"
    $needHostPort = "$ServerIp`:$AppPort"
    $statefulUpdated = @($stateful + @($needHost, $needHostPort)) | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique
    $corsUpdated = @($cors + @("http://$needHostPort", "https://$needHostPort")) | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique

    Update-EnvKey -Path $backendEnv -Key "SANCTUM_STATEFUL_DOMAINS" -Value ($statefulUpdated -join ",")
    Update-EnvKey -Path $backendEnv -Key "CORS_ALLOWED_ORIGINS" -Value ($corsUpdated -join ",")
    Update-EnvKey -Path $backendEnv -Key "APP_URL" -Value "http://$ServerIp`:$AppPort"
    Write-Host "  updated $backendEnv (SERVER_IP, APP_PORT, SANCTUM_STATEFUL_DOMAINS, CORS_ALLOWED_ORIGINS, APP_URL)"
}

# 3. Re-create the firewall rule
if ($PSCmdlet.ShouldProcess("Windows Firewall", "Allow inbound TCP $AppPort on Private profile")) {
    $ruleName = "Sistema Caja Hospitalaria - LAN TCP $AppPort"
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $AppPort `
        -Profile Private `
        -ErrorAction SilentlyContinue | Out-Null
    Write-Host "  firewall rule: $ruleName"
}

# 4. Restart docker stack
if ($PSCmdlet.ShouldProcess("docker compose", "Restart stack so env changes apply")) {
    & docker compose -f (Join-Path $ProjectRoot "docker-compose.prod.yml") restart backend queue-worker scheduler 2>&1 | Out-Null
    Write-Host "  docker compose restart: backend, queue-worker, scheduler"
}

Write-Host ""
Write-Host "Done. Verify with:"
Write-Host "  curl http://${ServerIp}:$AppPort/up"
Write-Host "  curl http://${ServerIp}:$AppPort/api/system/health"
Write-Host "  Nota: /api/system/echo-config y /api/system/setup-status exigen sesion"
Write-Host "  autenticada (sin sesion responden 401)."

if ($tlsActive) {
    Write-Host ""
    Write-Host "  [TLS] Recuerde: re-emitir el certificado (generate_local_ca.ps1 -Force), actualizar" -ForegroundColor Yellow
    Write-Host "        HOSPITAL_TLS_ORIGIN y recrear el stack con docker-compose.tls.yml (ver advertencia arriba)." -ForegroundColor Yellow
}

exit 0
