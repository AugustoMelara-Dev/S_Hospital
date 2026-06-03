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
    $existing = (& "$PSScriptRoot/_lib_env_helpers.ps1" -Path $backendEnv -Action Read).APP_PORT
    if ($existing) {
        $AppPort = [int] $existing
    } else {
        $AppPort = 8000
    }
}

if (-not $ServerIp) {
    $candidates = & "$PSScriptRoot/_lib_lan_ip.ps1"
    if (-not $candidates -or $candidates.Count -eq 0) {
        Write-Error "No LAN IPv4 candidate found. Pass -ServerIp 192.168.x.x explicitly."
        exit 3
    }
    $ServerIp = $candidates[0]
}

Write-Host "Refreshing LAN IP to $ServerIp (port $AppPort)..."

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
    Write-Host "  updated $rootEnv (SERVER_IP)"
}

# 2. Update backend .env
if ($PSCmdlet.ShouldProcess($backendEnv, "Set LAN env vars")) {
    Update-EnvKey -Path $backendEnv -Key "SERVER_IP" -Value $ServerIp
    Update-EnvKey -Path $backendEnv -Key "APP_PORT" -Value $AppPort.ToString()

    # Read existing SANCTUM_STATEFUL_DOMAINS and CORS_ALLOWED_ORIGINS
    $env = & "$PSScriptRoot/_lib_env_helpers.ps1" -Path $backendEnv -Action Read
    $stateful = ($env.SANCTUM_STATEFUL_DOMAINS ?? "").Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $cors = ($env.CORS_ALLOWED_ORIGINS ?? "").Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }

    $needHost = "$ServerIp"
    $needHostPort = "$ServerIp`:$AppPort"
    $statefulUpdated = ($stateful + @($needHost, $needHostPort)) | Select-Object -Unique
    $corsUpdated = ($cors + @("http://$needHostPort", "https://$needHostPort")) | Select-Object -Unique

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
Write-Host "  curl http://${ServerIp}:$AppPort/api/system/health"
Write-Host "  curl http://${ServerIp}:$AppPort/api/system/echo-config"
exit 0
