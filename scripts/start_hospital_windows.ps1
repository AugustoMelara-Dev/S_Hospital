#Requires -Version 5.1

param(
    [Parameter(Mandatory = $true)]
    [string] $ProjectRoot,
    [int] $DockerWaitSeconds = 180,
    [int] $HealthWaitSeconds = 180
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$composePath = Join-Path $resolvedProjectRoot 'docker-compose.prod.yml'
$envPath = Join-Path $resolvedProjectRoot '.env'
$logDirectory = Join-Path $resolvedProjectRoot 'install-logs'
$logPath = Join-Path $logDirectory 'windows-autostart.log'

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

function Write-AutostartLog {
    param([string] $Message)
    Add-Content -LiteralPath $logPath -Value ("{0:u} {1}" -f (Get-Date), $Message) -Encoding UTF8
}

function Test-DockerReady {
    & docker info *> $null
    return ($LASTEXITCODE -eq 0)
}

try {
    if (-not (Test-Path -LiteralPath $composePath -PathType Leaf)) {
        throw "No se encontro docker-compose.prod.yml."
    }
    if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
        throw "No se encontro la configuracion local .env."
    }

    if (-not (Test-DockerReady)) {
        $dockerDesktopPath = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (Test-Path -LiteralPath $dockerDesktopPath -PathType Leaf) {
            Start-Process -FilePath $dockerDesktopPath -WindowStyle Hidden | Out-Null
            Write-AutostartLog 'Docker Desktop solicitado.'
        }
    }

    $dockerDeadline = (Get-Date).AddSeconds($DockerWaitSeconds)
    while (-not (Test-DockerReady)) {
        if ((Get-Date) -ge $dockerDeadline) {
            throw 'Docker no estuvo listo dentro del tiempo esperado.'
        }
        Start-Sleep -Seconds 3
    }

    Push-Location $resolvedProjectRoot
    try {
        & docker compose -f $composePath --env-file $envPath up -d --no-build *> $null
        if ($LASTEXITCODE -ne 0) {
            throw 'Docker Compose no pudo iniciar S_Hospital.'
        }
    }
    finally {
        Pop-Location
    }

    $appPort = '8000'
    foreach ($line in Get-Content -LiteralPath $envPath) {
        if ($line -match '^\s*APP_PORT\s*=\s*(\d+)\s*$') {
            $appPort = $Matches[1]
            break
        }
    }

    $healthUrl = "http://127.0.0.1:$appPort/up"
    $healthDeadline = (Get-Date).AddSeconds($HealthWaitSeconds)
    $healthy = $false
    while (-not $healthy -and (Get-Date) -lt $healthDeadline) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
            $healthy = ($response.StatusCode -eq 200)
        }
        catch {
            Start-Sleep -Seconds 3
        }
    }
    if (-not $healthy) {
        throw "S_Hospital no respondio en $healthUrl."
    }

    Write-AutostartLog "S_Hospital disponible en http://127.0.0.1:$appPort."
    exit 0
}
catch {
    Write-AutostartLog ("ERROR: " + $_.Exception.Message)
    exit 1
}
