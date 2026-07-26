[CmdletBinding()]
param(
    [string] $ProjectRoot = "",
    [string] $OutputRoot = "",
    [string] $DockerDesktopInstallerPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-InnoCompiler {
    $command = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return $candidate
        }
    }

    throw @"
No se encontró ISCC.exe (Inno Setup 6).
Instale Inno Setup una sola vez en la PC donde se genera el instalador:
https://jrsoftware.org/isdl.php
Después vuelva a ejecutar este script.
"@
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $ProjectRoot "installer-output"
}

$offlineRelease = Join-Path $ProjectRoot "offline-release"
$installerDefinition = Join-Path $ProjectRoot "installer\S_Hospital.iss"
$releaseValidator = Join-Path $ProjectRoot "scripts\assert_offline_release_clean.ps1"
$buildDirectory = Join-Path $OutputRoot "build"
$usbDirectory = Join-Path $OutputRoot "ENTREGA-USB"
$installerName = "S_Hospital-Instalador.exe"
$compiledInstaller = Join-Path $buildDirectory $installerName
$usbInstaller = Join-Path $usbDirectory $installerName
$readmePath = Join-Path $usbDirectory "LEEME-INSTALACION.txt"
$checksumPath = Join-Path $usbDirectory "$installerName.sha256"

foreach ($requiredPath in @($offlineRelease, $installerDefinition, $releaseValidator)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Falta un archivo o directorio requerido: $requiredPath"
    }
}

Write-Host "[1/5] Validando que el paquete offline sea completo y seguro..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $releaseValidator -ReleaseRoot $offlineRelease
if ($LASTEXITCODE -ne 0) {
    throw "El paquete offline no superó la validación. No se generó el instalador."
}

$iscc = Resolve-InnoCompiler
New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $usbDirectory -Force | Out-Null

$commitCount = (& git -C $ProjectRoot rev-list --count HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commitCount -notmatch '^\d+$') {
    throw "No fue posible calcular la versión desde Git."
}
$appVersion = "1.0.$commitCount"

Write-Host "[2/5] Compilando $installerName con Inno Setup..."
$compilerArguments = @(
    "/DSourceRoot=$ProjectRoot",
    "/DOutputDir=$buildDirectory",
    "/DAppVersion=$appVersion",
    $installerDefinition
)
& $iscc $compilerArguments
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup terminó con código $LASTEXITCODE."
}
if (-not (Test-Path -LiteralPath $compiledInstaller -PathType Leaf)) {
    throw "Inno Setup no produjo el archivo esperado: $compiledInstaller"
}

Write-Host "[3/5] Preparando la carpeta ENTREGA-USB..."
Copy-Item -LiteralPath $compiledInstaller -Destination $usbInstaller -Force

$dockerIncluded = $false
if (-not [string]::IsNullOrWhiteSpace($DockerDesktopInstallerPath)) {
    $resolvedDockerInstaller = (Resolve-Path -LiteralPath $DockerDesktopInstallerPath).Path
    if ([IO.Path]::GetExtension($resolvedDockerInstaller) -ne ".exe") {
        throw "DockerDesktopInstallerPath debe apuntar al instalador oficial .exe de Docker Desktop."
    }
    Copy-Item -LiteralPath $resolvedDockerInstaller -Destination (Join-Path $usbDirectory "Docker Desktop Installer.exe") -Force
    $dockerIncluded = $true
}

Write-Host "[4/5] Generando instrucciones y suma SHA-256..."
$installerHash = (Get-FileHash -LiteralPath $usbInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
"$installerHash  $installerName" | Set-Content -LiteralPath $checksumPath -Encoding ascii

$dockerInstruction = if ($dockerIncluded) {
    "1. Ejecute 'Docker Desktop Installer.exe' y reinicie Windows si lo solicita."
} else {
    "1. Confirme que Docker Desktop ya esté instalado. Si no lo está, copie también su instalador oficial a esta memoria USB e instálelo primero."
}

@"
S_HOSPITAL - INSTALACIÓN EN UNA SOLA PC
=======================================

Contenido principal:
- $installerName
- $installerName.sha256
$(if ($dockerIncluded) { "- Docker Desktop Installer.exe" })

En el hospital:
$dockerInstruction
2. Copie $installerName desde la memoria USB al Escritorio de Windows.
3. Haga doble clic en $installerName y acepte el aviso de administrador.
4. Siga el asistente. Al finalizar se abrirá la configuración automática.
5. Espere el mensaje de instalación correcta y abra S_Hospital desde el icono del Escritorio.
6. Guarde la contraseña inicial del administrador en un lugar seguro y elimine del Escritorio el archivo temporal de credenciales después de cambiarla.
7. Complete en Configuración el nombre, RTN, dirección y datos fiscales reales del hospital.

Después de apagar y encender la PC, S_Hospital iniciará automáticamente.
No borre C:\S_Hospital ni los volúmenes de Docker: contienen configuración y datos.
Los respaldos automáticos quedan configurados por el instalador.

SHA-256 esperado:
$installerHash
"@ | Set-Content -LiteralPath $readmePath -Encoding utf8

Write-Host "[5/5] Instalador terminado."
Write-Host "Versión: $appVersion"
Write-Host "Carpeta para copiar a la memoria USB: $usbDirectory"
Write-Host "SHA-256: $installerHash"
