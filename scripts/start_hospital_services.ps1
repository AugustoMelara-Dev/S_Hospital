param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Protect-ServiceText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    if (-not [string]::IsNullOrWhiteSpace($script:ProjectRoot)) {
        $protected = $protected -replace [regex]::Escape($script:ProjectRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($script:ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

trap {
    Write-Host (Protect-ServiceText $_.Exception.Message)
    Write-Host 'No borre datos, volumenes Docker, respaldos ni archivos .env. Ejecute scripts\repair_hospital_system.ps1 si necesita diagnostico.'
    exit 1
}

Write-Host 'Iniciando servicios locales del Sistema de Caja Hospitalaria...'
Write-Host "Carpeta del sistema: %PROJECT_ROOT%"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw 'No se encontro la carpeta del sistema. Abra PowerShell desde la carpeta instalada de S_Hospital.'
}

Set-Location $ProjectRoot

$composeFiles = @('docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml')
$hasComposeFile = $false
foreach ($composeFile in $composeFiles) {
    if (Test-Path -LiteralPath (Join-Path $ProjectRoot $composeFile) -PathType Leaf) {
        $hasComposeFile = $true
        break
    }
}

if (-not $hasComposeFile) {
    throw 'No se encontro archivo Docker Compose en la carpeta del sistema. Verifique la instalacion antes de iniciar servicios.'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta instalado o no esta disponible en PATH. Instale o abra Docker Desktop antes de iniciar el sistema.'
}

docker compose up -d backend frontend mysql

Write-Host 'Servicios solicitados. Puede abrir el sistema con scripts\open_hospital_system.ps1.'
