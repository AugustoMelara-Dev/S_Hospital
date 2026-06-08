#requires -Version 5.1
<#
.SYNOPSIS
  Rotate the S_Hospital APP_KEY safely on a running installation.

.DESCRIPTION
  APP_KEY encrypts Sanctum tokens, session cookies, signed URLs and
  the local license signature. Rotating it invalidates all current
  cashier sessions, pending password reset tokens, and signed backup
  URLs. Run this during a maintenance window and notify the cashiers
  to log in again.

  The script:
    1. Generates a new 32-byte random key with .NET RandomNumberGenerator.
    2. Backs up the current .env to .env.bak.<timestamp> in the same folder.
    3. Updates APP_KEY in the .env file (atomic: tmp file + Move-Item).
    4. Runs `php artisan config:cache` so the new key is picked up
       by all subsequent requests inside the same container.
    5. In Docker mode, restarts backend, queue-worker and scheduler
       so the PHP-FPM workers reload the cached config.
    6. Pings /up to confirm the stack is healthy.

.PARAMETER ProjectRoot
  Defaults to the parent of the script directory.

.PARAMETER WhatIf
  Print the actions that would be taken without making any change.

.PARAMETER SkipContainerRestart
  Skip the docker compose restart step. Use this on bare-metal
  installations where PHP is wired differently.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rotate-app-key.ps1
  # Generates and applies the new key, restarts the docker stack.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rotate-app-key.ps1 -WhatIf
  # Shows the new key and the planned actions without applying them.
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string] $ProjectRoot,
    [switch] $SkipContainerRestart
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
    if ($PSScriptRoot) {
        $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    } else {
        $ProjectRoot = (Resolve-Path ".").Path
    }
}

$envPath = Join-Path $ProjectRoot ".env"
if (-not (Test-Path -LiteralPath $envPath)) {
    throw "No .env found at $envPath. Run setup.bat first."
}

. (Join-Path $ProjectRoot "scripts\lib\env_helpers.ps1")

function New-HospitalAppKey {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return "base64:" + [Convert]::ToBase64String($bytes)
}

function Read-DotEnvKey([string] $Path, [string] $Key) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $content = Get-Content -LiteralPath $Path -Raw
    $match = [regex]::Match($content, "^" + [regex]::Escape($Key) + "=(.*)$", [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if ($match.Success) { return $match.Groups[1].Value.Trim() }
    return $null
}

function Set-DotEnvKey([string] $Path, [string] $Key, [string] $Value) {
    $tmp = $Path + ".tmp"
    $content = Get-Content -LiteralPath $Path -Raw
    $pattern = "^" + [regex]::Escape($Key) + "=.*$"
    $replacement = "$Key=$Value"
    if ([regex]::IsMatch($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
        $content = [regex]::Replace($content, $pattern, $replacement, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    } else {
        if (-not $content.EndsWith([Environment]::NewLine)) { $content += [Environment]::NewLine }
        $content += "$replacement" + [Environment]::NewLine
    }
    Set-Content -LiteralPath $tmp -Value $content -Encoding ASCII -NoNewline
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

$currentKey = Read-DotEnvKey $envPath "APP_KEY"
if (-not $currentKey) {
    throw "APP_KEY is missing from $envPath. Refusing to rotate."
}
if ($currentKey -eq "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") {
    throw "APP_KEY is the test placeholder. Run setup.bat first to generate a real key."
}

$newKey = New-HospitalAppKey

if ($WhatIfPreference -or $PSCmdlet.ShouldProcess($envPath, "rotate APP_KEY")) {
    Write-Host "[*] Current APP_KEY: $($currentKey.Substring(0, 14))... (truncated)" -ForegroundColor Gray
    Write-Host "[*] New APP_KEY    : $($newKey.Substring(0, 14))... (truncated)" -ForegroundColor Gray
    Write-Host ""

    $backupPath = "$envPath.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Copy-Item -LiteralPath $envPath -Destination $backupPath
    Write-Host "[OK] Backup created: $backupPath" -ForegroundColor Green

    if ($WhatIfPreference) {
        Write-Host "[WHATIF] Would update APP_KEY in $envPath" -ForegroundColor Yellow
        Write-Host "[WHATIF] Would run php artisan config:cache (Docker exec or bare-metal)" -ForegroundColor Yellow
        if (-not $SkipContainerRestart) {
            Write-Host "[WHATIF] Would restart backend, queue-worker, scheduler" -ForegroundColor Yellow
        }
        Write-Host "[WHATIF] Would curl https://SERVER_IP:APP_HTTPS_PORT/up" -ForegroundColor Yellow
        exit 0
    }

    Set-DotEnvKey $envPath "APP_KEY" $newKey
    Write-Host "[OK] APP_KEY rotated in $envPath" -ForegroundColor Green

    $composeProd = Join-Path $ProjectRoot "docker-compose.prod.yml"
    $isDocker = (Test-DockerRunning -ErrorAction SilentlyContinue)

    if ($isDocker -and (Test-Path -LiteralPath $composeProd) -and -not $SkipContainerRestart) {
        Write-Host "[*] Refreshing config cache inside backend container..." -ForegroundColor Yellow
        & docker compose -f $composeProd exec -T backend php artisan config:cache 2>&1 | Out-String | Write-Host

        Write-Host "[*] Restarting backend, queue-worker, scheduler..." -ForegroundColor Yellow
        & docker compose -f $composeProd restart backend queue-worker scheduler 2>&1 | Out-String | Write-Host
    } else {
        Write-Host "[*] Bare-metal: refreshing config cache..." -ForegroundColor Yellow
        $backendDir = Join-Path $ProjectRoot "backend"
        Push-Location $backendDir
        try {
            & php artisan config:cache 2>&1 | Out-String | Write-Host
        } finally {
            Pop-Location
        }
    }

    $serverIp = (Read-DotEnvKey $envPath "SERVER_IP")
    $httpsPort = (Read-DotEnvKey $envPath "APP_HTTPS_PORT")
    if (-not $httpsPort) { $httpsPort = "8443" }
    $url = "https://$($serverIp):$httpsPort/up"
    Write-Host "[*] Pinging $url ..." -ForegroundColor Yellow
    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Timeout = 8000
        $req.ServerCertificateValidationCallback = { $true }  # local CA
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        $resp.Close()
        if ($code -eq 200) {
            Write-Host "[OK] $url responded 200" -ForegroundColor Green
        } else {
            Write-Host "[WARN] $url responded $code" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARN] Could not reach $url - $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "[OK] APP_KEY rotation complete." -ForegroundColor Green
    Write-Host "  All current sessions were invalidated. Cashiers must log in again." -ForegroundColor White
    Write-Host "  If the queue worker is on a Windows bare-metal host, restart it manually:" -ForegroundColor White
    Write-Host "    Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker" -ForegroundColor Gray
}
