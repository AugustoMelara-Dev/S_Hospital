param(
    [string] $Url = $env:HOSPITAL_SYSTEM_URL,
    [string] $ProjectRoot = "",
    [string] $RepairReportPath = "",
    [int] $Retries = 30,
    [int] $DelaySeconds = 2,
    [switch] $SkipRepair,
    [switch] $SkipDockerStart,
    [switch] $NoBrowser
)

$ErrorActionPreference = 'Stop'

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

if ([string]::IsNullOrWhiteSpace($Url)) {
    $Url = 'http://127.0.0.1:8000'
}

function Test-SystemUrl([string] $TargetUrl, [int] $Attempts, [int] $Delay) {
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            if ($i -eq 1) {
                Write-Host "El servidor local aun no responde. Esperando..."
            }
        }

        Start-Sleep -Seconds $Delay
    }

    return $false
}

function Open-SystemBrowser([string] $TargetUrl) {
    if ($NoBrowser) {
        Write-Host "Sistema disponible en $TargetUrl. Apertura de navegador omitida por parametro -NoBrowser."
        return
    }

    try {
        Start-Process $TargetUrl -WindowStyle Hidden
    } catch {
        Write-Host "El sistema responde, pero Windows no pudo abrir el navegador automaticamente."
        Write-Host "Abra manualmente esta direccion: $TargetUrl"
    }
}

Write-Host "Abriendo Sistema de Caja Hospitalaria en $Url"

if (Test-SystemUrl $Url $Retries $DelaySeconds) {
    Open-SystemBrowser $Url
    exit 0
}

Write-Host "No se pudo abrir el sistema en el primer intento."

if ($SkipRepair) {
    Write-Host "Reparacion segura omitida por parametro -SkipRepair."
    Write-Host "Ejecute scripts\repair_hospital_system.ps1 desde la computadora servidor si el problema continua."
    exit 1
}

$repairScript = Join-Path $ProjectRoot "scripts\repair_hospital_system.ps1"
$diagnosticPath = if ([string]::IsNullOrWhiteSpace($RepairReportPath)) {
    Join-Path $ProjectRoot "qa\LOCAL_REPAIR_DIAGNOSTIC.md"
} else {
    $RepairReportPath
}
$diagnosticDisplay = if ([string]::IsNullOrWhiteSpace($RepairReportPath)) {
    "qa\LOCAL_REPAIR_DIAGNOSTIC.md"
} else {
    $RepairReportPath
}

if (-not (Test-Path -LiteralPath $repairScript)) {
    Write-Host "No se encontro el script de reparacion segura."
    Write-Host "Avise a soporte y no borre archivos, volumenes Docker ni respaldos."
    exit 1
}

Write-Host "Iniciando reparacion segura. No se borran datos, no se restaura la base y no se ejecutan seeders."

$repairArgs = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $repairScript,
    "-ProjectRoot",
    $ProjectRoot,
    "-BaseUrl",
    $Url,
    "-ReportPath",
    $diagnosticPath,
    "-Retries",
    $Retries,
    "-DelaySeconds",
    $DelaySeconds
)

if ($NoBrowser) {
    $repairArgs += "-NoBrowser"
}

if ($SkipDockerStart) {
    $repairArgs += "-SkipDockerStart"
}

& powershell.exe @repairArgs
$repairExitCode = $LASTEXITCODE

if (Test-SystemUrl $Url 3 $DelaySeconds) {
    Open-SystemBrowser $Url
    if ($repairExitCode -eq 0) {
        Write-Host "Sistema recuperado correctamente."
        exit 0
    }

    Write-Host "El sistema abre, pero la reparacion dejo revisiones pendientes."
    Write-Host "Diagnostico: $diagnosticDisplay"
    exit 2
}

Write-Host "El sistema sigue sin abrir. Entregue este diagnostico a soporte:"
Write-Host $diagnosticDisplay
Write-Host "No borre .env, respaldos, carpetas de datos ni volumenes Docker."

if ($repairExitCode -eq 2) {
    exit 2
}

exit 1
