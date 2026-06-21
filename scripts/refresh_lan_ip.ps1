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

.PARAMETER EnvFile
  Optional production Docker env file. Use this when the stack was started with
  `docker compose --env-file C:\path\hospital.env`.

.PARAMETER ComposeProjectName
  Optional Docker Compose project name used by the production stack.

.PARAMETER WhatIf
  Print every change that WOULD be made without applying it.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $ProjectRoot,
    [string] $ServerIp,
    [int] $AppPort = 0,
    [string] $EnvFile = "",
    [string] $ComposeProjectName = ""
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$rootEnv = Join-Path $ProjectRoot ".env"
$backendEnv = Join-Path $ProjectRoot "backend/.env"
$externalEnv = ""

if ($EnvFile -ne "") {
    if ([System.IO.Path]::IsPathRooted($EnvFile)) {
        $externalEnv = $EnvFile
    } else {
        $externalEnv = Join-Path $ProjectRoot $EnvFile
    }
    if (-not (Test-Path -LiteralPath $externalEnv)) {
        Write-Error "EnvFile not found: $externalEnv"
        exit 2
    }
}

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
    $portEnvPath = if ($externalEnv -ne "") { $externalEnv } else { $backendEnv }
    $envData = Read-EnvFile -path $portEnvPath
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
    $ServerIp = [string] $candidates[0].IPAddress
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

. "$PSScriptRoot/lib/env_helpers.ps1"
$runtimeEnvPath = if ($externalEnv -ne "") { $externalEnv } else { $rootEnv }
$rootEnvData = Read-EnvFile -path $runtimeEnvPath
$soketiPort = 6001
if ($rootEnvData.ContainsKey("SOKETI_PORT") -and $rootEnvData.SOKETI_PORT -match '^\d+$') {
    $soketiPort = [int] $rootEnvData.SOKETI_PORT
}
if ($soketiPort -lt 1 -or $soketiPort -gt 65535) {
    Write-Error "SOKETI_PORT fuera de rango en .env raiz: $soketiPort"
    exit 4
}

# 1. Update root .env. The production preflight reads this file directly,
# so keep explicit runtime values here even when docker-compose can derive
# the same values in container environment.
if ($PSCmdlet.ShouldProcess($rootEnv, "Set LAN runtime env vars")) {
    Update-EnvKey -Path $rootEnv -Key "SERVER_IP" -Value $ServerIp
    Update-EnvKey -Path $rootEnv -Key "APP_PORT" -Value $AppPort.ToString()
    Update-EnvKey -Path $rootEnv -Key "APP_ENV" -Value "production"
    Update-EnvKey -Path $rootEnv -Key "APP_DEBUG" -Value "false"
    Update-EnvKey -Path $rootEnv -Key "APP_URL" -Value "http://$ServerIp`:$AppPort"
    Update-EnvKey -Path $rootEnv -Key "DB_CONNECTION" -Value "mysql"
    Update-EnvKey -Path $rootEnv -Key "DB_HOST" -Value "mysql"
    Update-EnvKey -Path $rootEnv -Key "DB_PORT" -Value "3306"
    Update-EnvKey -Path $rootEnv -Key "QUEUE_CONNECTION" -Value "database"
    Update-EnvKey -Path $rootEnv -Key "SANCTUM_STATEFUL_DOMAINS" -Value "$ServerIp,$ServerIp`:$AppPort"
    Update-EnvKey -Path $rootEnv -Key "CORS_ALLOWED_ORIGINS" -Value "http://$ServerIp`:$AppPort,https://$ServerIp`:$AppPort"
    Update-EnvKey -Path $rootEnv -Key "CORS_ALLOWED_ORIGIN_PATTERNS" -Value ""
    Update-EnvKey -Path $rootEnv -Key "SOKETI_PORT" -Value $soketiPort.ToString()
    Update-EnvKey -Path $rootEnv -Key "PUSHER_CLIENT_HOST" -Value $ServerIp
    Update-EnvKey -Path $rootEnv -Key "PUSHER_CLIENT_PORT" -Value $soketiPort.ToString()
    Write-Host "  updated $rootEnv (LAN runtime keys)"
}

# 2. Update backend .env
if ($PSCmdlet.ShouldProcess($backendEnv, "Set LAN env vars")) {
    Update-EnvKey -Path $backendEnv -Key "SERVER_IP" -Value $ServerIp
    Update-EnvKey -Path $backendEnv -Key "APP_PORT" -Value $AppPort.ToString()

    # Read existing SANCTUM_STATEFUL_DOMAINS and CORS_ALLOWED_ORIGINS
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
    Update-EnvKey -Path $backendEnv -Key "PUSHER_CLIENT_HOST" -Value $ServerIp
    Update-EnvKey -Path $backendEnv -Key "PUSHER_CLIENT_PORT" -Value $soketiPort.ToString()
    Update-EnvKey -Path $backendEnv -Key "PUSHER_CLIENT_SCHEME" -Value "http"
    Write-Host "  updated $backendEnv (SERVER_IP, APP_PORT, SANCTUM_STATEFUL_DOMAINS, CORS_ALLOWED_ORIGINS, APP_URL)"
}

# 3. Update an external production Docker env file when used.
if ($externalEnv -ne "" -and $PSCmdlet.ShouldProcess($externalEnv, "Set LAN runtime env vars")) {
    Update-EnvKey -Path $externalEnv -Key "SERVER_IP" -Value $ServerIp
    Update-EnvKey -Path $externalEnv -Key "APP_PORT" -Value $AppPort.ToString()
    Update-EnvKey -Path $externalEnv -Key "APP_ENV" -Value "production"
    Update-EnvKey -Path $externalEnv -Key "APP_DEBUG" -Value "false"
    Update-EnvKey -Path $externalEnv -Key "APP_URL" -Value "http://$ServerIp`:$AppPort"
    Update-EnvKey -Path $externalEnv -Key "DB_CONNECTION" -Value "mysql"
    Update-EnvKey -Path $externalEnv -Key "DB_HOST" -Value "mysql"
    Update-EnvKey -Path $externalEnv -Key "DB_PORT" -Value "3306"
    Update-EnvKey -Path $externalEnv -Key "QUEUE_CONNECTION" -Value "database"
    Update-EnvKey -Path $externalEnv -Key "SANCTUM_STATEFUL_DOMAINS" -Value "$ServerIp,$ServerIp`:$AppPort"
    Update-EnvKey -Path $externalEnv -Key "CORS_ALLOWED_ORIGINS" -Value "http://$ServerIp`:$AppPort,https://$ServerIp`:$AppPort"
    Update-EnvKey -Path $externalEnv -Key "CORS_ALLOWED_ORIGIN_PATTERNS" -Value ""
    Update-EnvKey -Path $externalEnv -Key "SOKETI_PORT" -Value $soketiPort.ToString()
    Update-EnvKey -Path $externalEnv -Key "PUSHER_CLIENT_HOST" -Value $ServerIp
    Update-EnvKey -Path $externalEnv -Key "PUSHER_CLIENT_PORT" -Value $soketiPort.ToString()
    Update-EnvKey -Path $externalEnv -Key "PUSHER_CLIENT_SCHEME" -Value "http"
    Write-Host "  updated $externalEnv (LAN runtime keys)"
}

# 4. Re-create the firewall rule
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
        -RemoteAddress LocalSubnet `
        -ErrorAction SilentlyContinue | Out-Null
    Write-Host "  firewall rule: $ruleName"

    $legacySoketiRuleName = "Sistema Caja Hospitalaria - Soketi LAN TCP 6001"
    $soketiRuleName = "Sistema Caja Hospitalaria - Soketi LAN TCP $soketiPort"
    Remove-NetFirewallRule -DisplayName $legacySoketiRuleName -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName $soketiRuleName -ErrorAction SilentlyContinue
    New-NetFirewallRule `
        -DisplayName $soketiRuleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $soketiPort `
        -Profile Private `
        -RemoteAddress LocalSubnet `
        -ErrorAction SilentlyContinue | Out-Null
    Write-Host "  firewall rule: $soketiRuleName"
}

# 5. Restart docker stack
if ($PSCmdlet.ShouldProcess("docker compose", "Recreate app containers so env changes apply")) {
    $composePath = Join-Path $ProjectRoot "docker-compose.prod.yml"
    $composeEnv = if ($externalEnv -ne "") { $externalEnv } else { $rootEnv }
    $composeArgs = @("compose")
    if ($ComposeProjectName -ne "") {
        $composeArgs += @("-p", $ComposeProjectName)
    }
    $composeArgs += @("-f", $composePath, "--env-file", $composeEnv, "up", "-d", "--force-recreate", "--no-build", "backend", "queue-worker", "scheduler", "nginx")
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & docker @composeArgs 2>&1 | Out-Null
        $dockerExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($dockerExitCode -ne 0) {
        Write-Error "docker compose up failed with exit code $dockerExitCode"
        exit 5
    }
    Write-Host "  docker compose up: recreated backend, queue-worker, scheduler, nginx"
}

Write-Host ""
Write-Host "Done. Verify with:"
Write-Host "  curl http://${ServerIp}:$AppPort/api/system/health"
Write-Host "  curl http://${ServerIp}:$AppPort/api/system/echo-config"
exit 0
