param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string] $Url = $env:HOSPITAL_SYSTEM_URL,
    [switch] $WhatIf
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Url)) {
    $Url = 'http://127.0.0.1:8000'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = Join-Path $ProjectRoot 'install-logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$logPath = Join-Path $logDir "repair-$timestamp.log"

function Write-RepairLog {
    param([string] $Message)
    $line = "$(Get-Date -Format 's') $Message"
    Add-Content -Path $logPath -Value $line
    Write-Host $Message
}

Write-RepairLog "Iniciando revision no destructiva del Sistema de Caja Hospitalaria."
Write-RepairLog "Proyecto: $ProjectRoot"
Write-RepairLog "URL: $Url"
Write-RepairLog "Este proceso no borra datos, no reinicia migraciones y no ejecuta datos de demostracion."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-RepairLog "Docker no esta disponible en PATH."
    exit 1
}

Set-Location $ProjectRoot

if ($WhatIf) {
    Write-RepairLog "Modo WhatIf: se validan pasos sin iniciar servicios ni abrir navegador."
    Write-RepairLog "Se ejecutaria: docker compose up -d backend frontend mysql"
    Write-RepairLog "Se verificaria respuesta HTTP en $($Url.TrimEnd('/'))/up y $($Url.TrimEnd('/'))/login"
    exit 0
}

Write-RepairLog "Levantando servicios locales sin borrar datos."
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$composeOutput = & cmd.exe /d /c "docker compose up -d backend frontend mysql" 2>&1
$composeExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($composeOutput) {
    $composeOutput | ForEach-Object {
        Write-RepairLog ("Docker: " + $_.ToString())
    }
}

if ($composeExitCode -ne 0) {
    Write-RepairLog "ADVERTENCIA: Docker no pudo levantar servicios. Se revisara si el servidor ya esta respondiendo antes de fallar."
}

$healthUrl = $Url.TrimEnd('/') + '/up'
$loginUrl = $Url.TrimEnd('/') + '/login'

for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
        Write-RepairLog "Servidor backend responde con HTTP $($response.StatusCode) en /up."
        break
    } catch {
        if ($i -eq 1) {
            Write-RepairLog "Esperando respuesta del servidor local..."
        }
        Start-Sleep -Seconds 2
    }

    if ($i -eq 30) {
        Write-RepairLog "No se pudo confirmar respuesta de /up. Revise el log: $logPath"
        docker compose logs --tail=80 backend | Tee-Object -FilePath $logPath -Append
        exit 1
    }
}

try {
    $loginResponse = Invoke-WebRequest -Uri $loginUrl -UseBasicParsing -TimeoutSec 5
    Write-RepairLog "Pantalla de login responde con HTTP $($loginResponse.StatusCode)."
} catch {
    Write-RepairLog "Advertencia: /login no respondio correctamente. $($_.Exception.Message)"
}

Start-Process $loginUrl -WindowStyle Hidden
Write-RepairLog "Sistema abierto en navegador."
Write-RepairLog "Diagnostico guardado en $logPath"
exit 0
