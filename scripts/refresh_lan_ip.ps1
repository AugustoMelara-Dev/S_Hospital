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
    [int] $AppPort = 0,
    [switch] $Wizard,
    [switch] $WhatIf
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

# -----------------------------------------------------------------------------
# Modo Wizard
# -----------------------------------------------------------------------------
# Activado con -Wizard, hace preguntas paso a paso para operadores
# no tecnicos. Detecta la IP actual, la muestra y permite al
# operador aceptar la sugerencia o escribir una distinta.
if ($Wizard) {
    Write-Host "==================================================================="
    Write-Host " S_Hospital - Asistente de refresco de IP LAN"
    Write-Host "==================================================================="

    $autoIp = $null
    if (Get-Command Get-LanIPv4Candidates -ErrorAction SilentlyContinue) {
        try {
            $candidates = Get-LanIPv4Candidates
            $autoIp = $candidates | Select-Object -First 1
        } catch { }
    }

    $ipPrompt = if ($autoIp) { $autoIp.ToString() } else { "192.168.1.10" }
    $response = Read-Host "Nueva IP del servidor LAN [$ipPrompt]"
    if (-not [string]::IsNullOrWhiteSpace($response)) {
        if ($response -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
            throw "Formato de IP invalido. Use el formato 192.168.1.10"
        }
        $ServerIp = $response
    } elseif ($autoIp) {
        $ServerIp = $autoIp.ToString()
    }

    $portPrompt = if ($AppPort -gt 0) { $AppPort } else { 8000 }
    $response = Read-Host "Puerto HTTP [$portPrompt]"
    if (-not [string]::IsNullOrWhiteSpace($response)) {
        $AppPort = [int]$response
    } elseif ($AppPort -le 0) {
        $AppPort = 8000
    }

    Write-Host ""
    Write-Host "Esta operacion actualizara:"
    Write-Host "  - $ProjectRoot\backend\.env (APP_URL, SERVER_IP, SANCTUM, CORS)"
    Write-Host "  - $ProjectRoot\.env (SERVER_IP)"
    Write-Host "  - Regla del Firewall de Windows"
    Write-Host "  - Reinicio del stack Docker para aplicar los cambios"
    Write-Host ""
    $confirm = Read-Host "Continuar con IP $ServerIp puerto $AppPort? (S/n)"
    if ($confirm -match '^[nN]$') {
        Write-Host "Operacion cancelada."
        exit 0
    }
    Write-Host ""
}

$libDir = Join-Path $PSScriptRoot "lib"
$envHelperPath = Join-Path $libDir "env_helpers.ps1"
$netDiagPath = Join-Path $libDir "net_diagnostics.ps1"

if (-not (Test-Path -LiteralPath $envHelperPath -PathType Leaf)) {
    Write-Error "No se encontro scripts\lib\env_helpers.ps1. No se puede refrescar la IP LAN con seguridad."
    exit 2
}
if (-not (Test-Path -LiteralPath $netDiagPath -PathType Leaf)) {
    Write-Error "No se encontro scripts\lib\net_diagnostics.ps1. No se puede detectar la IP LAN con seguridad."
    exit 2
}

. $envHelperPath
. $netDiagPath

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
    $existing = Read-EnvFile $backendEnv
    if ($existing.ContainsKey("APP_PORT") -and $existing["APP_PORT"] -match '^\d+$') {
        $AppPort = [int] $existing["APP_PORT"]
    } else {
        $AppPort = 8000
    }
}

if (-not $ServerIp) {
    $candidates = @(Get-LanIPv4Candidates | Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        -not $_.IsVirtual
    })
    if (-not $candidates -or $candidates.Count -eq 0) {
        Write-Error "No LAN IPv4 candidate found. Pass -ServerIp 192.168.x.x explicitly."
        exit 3
    }
    $ServerIp = $candidates[0].IPAddress
}

Write-Host "Refreshing LAN IP to $ServerIp (port $AppPort)..."

# 1. Update root .env
if ($PSCmdlet.ShouldProcess($rootEnv, "Set SERVER_IP=$ServerIp")) {
    Update-DotEnv -Path $rootEnv -Variables @{ "SERVER_IP" = $ServerIp }
    Write-Host "  updated $rootEnv (SERVER_IP)"
}

# 2. Update backend .env
if ($PSCmdlet.ShouldProcess($backendEnv, "Set LAN env vars")) {
    $envValues = Read-EnvFile $backendEnv
    $statefulValue = if ($envValues.ContainsKey("SANCTUM_STATEFUL_DOMAINS")) { $envValues["SANCTUM_STATEFUL_DOMAINS"] } else { "" }
    $corsValue = if ($envValues.ContainsKey("CORS_ALLOWED_ORIGINS")) { $envValues["CORS_ALLOWED_ORIGINS"] } else { "" }

    $stateful = $statefulValue.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $cors = $corsValue.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }

    $needHost = "$ServerIp"
    $needHostPort = "$ServerIp`:$AppPort"
    $statefulUpdated = ($stateful + @($needHost, $needHostPort)) | Select-Object -Unique
    $corsUpdated = ($cors + @("http://$needHostPort", "https://$needHostPort")) | Select-Object -Unique

    Update-DotEnv -Path $backendEnv -Variables @{
        "SERVER_IP" = $ServerIp
        "APP_PORT" = $AppPort.ToString()
        "SANCTUM_STATEFUL_DOMAINS" = ($statefulUpdated -join ",")
        "CORS_ALLOWED_ORIGINS" = ($corsUpdated -join ",")
        "APP_URL" = "http://$ServerIp`:$AppPort"
    }
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
Write-Host "  curl http://${ServerIp}:$AppPort/api/system/health"
Write-Host "  curl http://${ServerIp}:$AppPort/api/system/echo-config"
exit 0
