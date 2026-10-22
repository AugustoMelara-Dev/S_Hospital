#Requires -Version 5.1
# Paquete offline sin compilacion ni descargas en la PC del hospital.
#
# Contrato: la instalacion offline carga imagenes ya construidas y levanta el
# stack con --no-build. No se ejecuta npm/pnpm/composer ni se descargan
# dependencias o imagenes en el servidor del hospital.
#
# Prueba de contrato estatica; no requiere Docker.

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Get-RequiredFileContent {
    param([string] $RelativePath)
    $full = Join-Path $projectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "Falta un archivo requerido por el contrato offline: $RelativePath"
    }
    return Get-Content -LiteralPath $full -Raw
}

$script:Checks = 0

function Assert-Contains {
    param([string] $Content, [string] $Needle, [string] $Label)
    $script:Checks++
    if (-not $Content.Contains($Needle)) {
        throw "Se esperaba que $Label contuviera: $Needle"
    }
}

function Assert-NotContains {
    param([string] $Content, [string] $Needle, [string] $Label)
    $script:Checks++
    if ($Content.Contains($Needle)) {
        throw "Se esperaba que $Label NO contuviera: $Needle"
    }
}

$deploy = Get-RequiredFileContent 'scripts\deploy_hospital_lan.ps1'
$start = Get-RequiredFileContent 'scripts\start_hospital_windows.ps1'
$setup = Get-RequiredFileContent 'setup.bat'
$builder = Get-RequiredFileContent 'scripts\make_offline_release.ps1'
$loader = Get-RequiredFileContent 'scripts\load_offline_images.ps1'
$dockerfile = Get-RequiredFileContent 'backend\Dockerfile.prod'

# --- El instalador offline carga imagenes y no reconstruye ---
Assert-Contains $deploy 'scripts\load_offline_images.ps1' 'El instalador debe invocar el cargador offline'
Assert-Contains $deploy 'up -d --no-build' 'El modo offline debe levantar sin reconstruir'
Assert-Contains $start 'up -d --no-build' 'El arranque de Windows debe levantar sin reconstruir'

# --- El arranque/instalacion del hospital no compila dependencias ---
foreach ($tool in @('npm', 'pnpm', 'composer')) {
    Assert-NotContains $deploy $tool "El instalador no debe invocar $tool"
    Assert-NotContains $start $tool "El arranque no debe invocar $tool"
    Assert-NotContains $setup $tool "setup.bat no debe invocar $tool"
}
Assert-NotContains $setup 'docker compose exec' 'setup.bat no debe ejecutar comandos dentro de contenedores durante la instalacion'

# --- Las imagenes se construyen en la maquina de release, no en el hospital ---
Assert-Contains $dockerfile 'RUN pnpm install --frozen-lockfile' 'El frontend se prepara en el build de la imagen'
Assert-Contains $dockerfile 'RUN composer install --no-dev' 'Las dependencias PHP se preparan en el build de la imagen'
Assert-Contains $builder 'docker save' 'El release exporta imagenes ya construidas'
Assert-Contains $loader 'docker load' 'El hospital solo carga imagenes locales'
Assert-NotContains $builder 'npm install' 'El builder no usa npm install'

Write-Host "[ OK ] Offline no-build contract passed: $script:Checks checks (sin npm/composer/descargas en el hospital)."
