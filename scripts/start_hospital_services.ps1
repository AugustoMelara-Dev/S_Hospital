param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch] $WhatIfOnly
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

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

Write-Host 'Iniciando servicios locales del Sistema de Caja Hospitalaria...'
Write-Host "Carpeta del sistema: %PROJECT_ROOT%"

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw 'No se encontro la carpeta del sistema. Abra PowerShell desde la carpeta instalada de S_Hospital.'
}

Set-Location $ProjectRoot

function Resolve-DockerRuntime {
    $prodCompose = Join-Path $ProjectRoot 'docker-compose.prod.yml'
    $devCompose = Join-Path $ProjectRoot 'docker-compose.yml'
    $rootEnv = Join-Path $ProjectRoot '.env'
    $offlineImages = Join-Path $ProjectRoot 'offline-images'
    $releaseSetup = Join-Path $ProjectRoot 'setup.bat'

    $isOfflinePackage = (Test-Path -LiteralPath $offlineImages -PathType Container) -or
        ((Test-Path -LiteralPath $releaseSetup -PathType Leaf) -and -not (Test-Path -LiteralPath $devCompose -PathType Leaf))

    if ((Test-Path -LiteralPath $prodCompose -PathType Leaf) -and ($isOfflinePackage -or -not (Test-Path -LiteralPath $devCompose -PathType Leaf))) {
        $composeArgs = @('compose')
        if (Test-Path -LiteralPath $rootEnv -PathType Leaf) {
            $composeArgs += @('--env-file', $rootEnv)
        }
        $composeArgs += @('-f', $prodCompose)

        return @{
            Mode = 'offline-docker'
            ComposeArgs = $composeArgs
            Services = @('backend', 'nginx', 'mysql', 'queue-worker', 'scheduler', 'soketi')
        }
    }

    if (Test-Path -LiteralPath $devCompose -PathType Leaf) {
        return @{
            Mode = 'development-docker'
            ComposeArgs = @('compose')
            Services = @('backend', 'frontend', 'mysql')
        }
    }

    return $null
}

$dockerRuntime = Resolve-DockerRuntime
if ($null -eq $dockerRuntime) {
    throw 'No se encontro archivo Docker Compose en la carpeta del sistema. Verifique la instalacion antes de iniciar servicios.'
}

if ($WhatIfOnly) {
    Write-Host 'Validacion de arranque completada.'
    Write-Host "Modo Docker detectado: $($dockerRuntime.Mode)."
    Write-Host "Servicios que se solicitarian: $($dockerRuntime.Services -join ', ')."
    Write-Host 'Modo WhatIf: no se levanta Docker y no se modifican contenedores.'
    exit 0
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta instalado o no esta disponible en PATH. Instale o abra Docker Desktop antes de iniciar el sistema.'
}

$upArgs = @($dockerRuntime.ComposeArgs + @('up', '-d') + $dockerRuntime.Services)
& docker @upArgs

Write-Host "Servicios solicitados en modo $($dockerRuntime.Mode): $($dockerRuntime.Services -join ', ')."
Write-Host 'Puede abrir el sistema con scripts\open_hospital_system.ps1.'
