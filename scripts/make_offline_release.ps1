param(
    [string] $ProjectRoot = "",
    [string] $ReleaseRoot = "",
    [switch] $Force,
    [switch] $AllowDirty,
    [switch] $SkipDockerBuild,
    [switch] $SkipDockerSave,
    [switch] $SkipGuard
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

if ($ReleaseRoot -eq "") {
    $ReleaseRoot = Join-Path $ProjectRoot "offline-release"
}

$ReleaseRoot = [System.IO.Path]::GetFullPath($ReleaseRoot)
$imagesDir = Join-Path $ReleaseRoot "offline-images"
$composePath = Join-Path $ProjectRoot "docker-compose.prod.yml"
$guardScript = Join-Path $ProjectRoot "scripts\assert_offline_release_clean.ps1"
$dockerSourcesGuard = Join-Path $ProjectRoot "scripts\assert_production_docker_sources.ps1"

function Write-Step([string] $message) {
    Write-Host "[*] $message" -ForegroundColor Yellow
}

function Write-Fail([string] $message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    exit 1
}

function Copy-RequiredFile([string] $relativePath) {
    $source = Join-Path $ProjectRoot $relativePath
    $target = Join-Path $ReleaseRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        Write-Fail "Falta archivo requerido: $relativePath"
    }

    $targetDir = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    Copy-Item -LiteralPath $source -Destination $target -Force
}

function Copy-RequiredDirectory([string] $relativePath) {
    $source = Join-Path $ProjectRoot $relativePath
    $target = Join-Path $ReleaseRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        Write-Fail "Falta directorio requerido: $relativePath"
    }

    Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

function Copy-ReleaseDocumentation {
    $docsTarget = Join-Path $ReleaseRoot "docs"
    New-Item -ItemType Directory -Force -Path $docsTarget | Out-Null

    $docsToCopy = @(
        "ACTA_ENTREGA_TECNICA.md",
        "ALCANCE_FINAL_FACTURACION_OFFLINE.md",
        "BACKUP_RESTORE.md",
        "DISASTER_RECOVERY.md",
        "ENTREGA_TECNICA_OFFLINE.md",
        "GUIA_BACKUP_RESTORE.md",
        "GUIA_IMPRESION_RECIBOS.md",
        "GUIA_LAN_CLIENTE.md",
        "GUIA_OPERACION_CAJA.md",
        "GUIA_REPORTES.md",
        "HTTPS_OPTIONAL.md",
        "INSTALL_SUMMARY.md",
        "INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md",
        "Manual_Usuario.html",
        "Manual_Usuario.md",
        "MODULOS_FUERA_DE_ALCANCE.md",
        "MODULOS_IMPLEMENTADOS.md",
        "OFFLINE_CHECKLIST_FINAL.md",
        "OFFLINE_DICTAMEN_FINAL.md",
        "OFFLINE_LAN_INSTALL.md",
        "PENDIENTES_VALIDACION_CAMPO.md",
        "PERMISSIONS_MATRIX.md",
        "PHASE_G_LAN_OFFLINE_VALIDATION_GUIDE.md",
        "QUALITY_GATES_WINDOWS.md",
        "RELEASE_CHECKLIST.md",
        "SECRETS.md",
        "TROUBLESHOOTING.md"
    )

    foreach ($docName in $docsToCopy) {
        $source = Join-Path $ProjectRoot "docs\$docName"
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            Write-Fail "Falta documento operativo requerido: docs\$docName"
        }

        Copy-Item -LiteralPath $source -Destination (Join-Path $docsTarget $docName) -Force
    }

    Copy-RequiredDirectory "docs\manuales"
}

function Copy-ReleaseEvidenceTemplates {
    $qaTarget = Join-Path $ReleaseRoot "qa"
    New-Item -ItemType Directory -Force -Path $qaTarget | Out-Null

    foreach ($templateName in @(
        "LAN_CLIENT_VALIDATION_PROOF.example.md",
        "INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md",
        "FINAL_RESTORE_PROOF.example.md",
        "FINAL_CONCURRENCY_PROOF.example.md",
        "FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.example.md",
        "FINAL_REAL_SMOKE_LAN_8081.example.md"
    )) {
        Copy-RequiredFile "qa\$templateName"
    }
}

function Get-GitValue([string[]] $arguments, [string] $fallback) {
    try {
        $value = (& git -C $ProjectRoot @arguments 2>$null).Trim()
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    } catch {}

    return $fallback
}

if (-not (Test-Path -LiteralPath $composePath -PathType Leaf)) {
    Write-Fail "Falta docker-compose.prod.yml versionado."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "backend\Dockerfile.prod") -PathType Leaf)) {
    Write-Fail "Falta backend\Dockerfile.prod versionado."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "nginx\default.conf") -PathType Leaf)) {
    Write-Fail "Falta nginx\default.conf versionado."
}

if (-not (Test-Path -LiteralPath $dockerSourcesGuard -PathType Leaf)) {
    Write-Fail "Falta scripts\assert_production_docker_sources.ps1 versionado."
}

Write-Step "Validando fuentes Docker productivas."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dockerSourcesGuard -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Las fuentes Docker productivas no son reproducibles."
}

$gitStatus = Get-GitValue @("status", "--porcelain") ""
if (-not $AllowDirty -and -not [string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Fail "El arbol Git tiene cambios sin commitear. Use -AllowDirty solo para pruebas de script, no para release final."
}

if ((Test-Path -LiteralPath $ReleaseRoot) -and -not $Force) {
    $response = Read-Host "La carpeta de release ya existe. Desea reemplazarla? (s/n)"
    if ($response -notmatch '^s') {
        Write-Fail "Operacion cancelada por el usuario."
    }
}

if (Test-Path -LiteralPath $ReleaseRoot) {
    Remove-Item -LiteralPath $ReleaseRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $ReleaseRoot, $imagesDir | Out-Null

$gitCommit = Get-GitValue @("rev-parse", "HEAD") "unknown"
$gitShort = Get-GitValue @("rev-parse", "--short", "HEAD") "unknown"
$gitBranch = Get-GitValue @("rev-parse", "--abbrev-ref", "HEAD") "unknown"

Write-Step "Copiando archivos versionados de instalacion."
Copy-RequiredFile "docker-compose.prod.yml"
Copy-RequiredFile "backend\Dockerfile.prod"
Copy-RequiredFile "nginx\default.conf"
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "scripts\release_setup.bat") -PathType Leaf)) {
    Write-Fail "Falta scripts\release_setup.bat versionado."
}
Copy-RequiredDirectory "scripts"
Copy-ReleaseDocumentation
Copy-ReleaseEvidenceTemplates
Copy-Item -LiteralPath (Join-Path $ProjectRoot "scripts\release_setup.bat") -Destination (Join-Path $ReleaseRoot "setup.bat") -Force
Remove-Item -LiteralPath (Join-Path $ReleaseRoot "scripts\release_setup.bat") -Force

if (-not $SkipDockerBuild) {
    if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
        Write-Fail "Docker es requerido para construir imagenes offline."
    }

    Write-Step "Construyendo imagenes Docker productivas."
    $env:SERVER_IP = "127.0.0.1"
    $env:APP_KEY = "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    $env:DB_PASSWORD = "build_password"
    $env:DB_ROOT_PASSWORD = "build_root_password"
    $env:PUSHER_APP_ID = "offline-build-app"
    $env:PUSHER_APP_KEY = "offline-build-key"
    $env:PUSHER_APP_SECRET = "offline-build-secret"
    & docker compose -f $composePath build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Fallo docker compose build."
    }
}

$imagesToSave = @(
    @{ Service = "backend"; Image = "s_hospital-backend:latest"; Target = "backend.tar" },
    @{ Service = "queue-worker"; Image = "s_hospital-queue-worker:latest"; Target = "queue-worker.tar" },
    @{ Service = "scheduler"; Image = "s_hospital-scheduler:latest"; Target = "scheduler.tar" },
    @{ Service = "nginx"; Image = "nginx:1.25.4-alpine"; Target = "nginx.tar" },
    @{ Service = "mysql"; Image = "mariadb:11.4.3"; Target = "mariadb.tar" },
    @{ Service = "soketi"; Image = "quay.io/soketi/soketi:1.6-16-alpine"; Target = "soketi.tar" }
)

if (-not $SkipDockerSave) {
    foreach ($item in $imagesToSave) {
        $target = Join-Path $imagesDir $item.Target
        Write-Step "Exportando $($item.Image) a offline-images\$($item.Target)."
        & docker save -o $target $item.Image
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Fallo docker save para $($item.Image)."
        }
    }
}

$tarFiles = @(Get-ChildItem -LiteralPath $imagesDir -Filter "*.tar" -File)
$checksums = New-Object System.Collections.Generic.List[string]
$tarList = New-Object System.Collections.Generic.List[string]
$totalSizeBytes = 0L

foreach ($tar in $tarFiles) {
    $hash = (Get-FileHash -LiteralPath $tar.FullName -Algorithm SHA256).Hash
    $checksums.Add("$hash  offline-images/$($tar.Name)") | Out-Null
    Set-Content -LiteralPath "$($tar.FullName).sha256" -Value $hash -Encoding ASCII
    $sizeMb = [Math]::Round($tar.Length / 1MB, 2)
    $totalSizeBytes += $tar.Length
    $tarList.Add("- $($tar.Name): $sizeMb MB") | Out-Null
}

Set-Content -LiteralPath (Join-Path $ReleaseRoot "checksums.sha256") -Value $checksums -Encoding ASCII

$totalSizeMb = [Math]::Round($totalSizeBytes / 1MB, 2)
$imageList = if ($tarList.Count -gt 0) { $tarList -join "`r`n" } else { "- No image archives generated in this script run." }
$manifest = @"
======================================================================
     SISTEMA DE CAJA HOSPITALARIA - OFFLINE RELEASE MANIFEST
======================================================================
Fecha de Generacion : $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Rama Git            : $gitBranch
Commit Git          : $gitCommit
Commit Corto        : $gitShort
Tamano Total Images : $totalSizeMb MB

IMAGENES INCLUIDAS:
$imageList

INSTRUCCIONES RAPIDAS DE INSTALACION:
1. Copie todo el contenido de esta carpeta a la PC servidor.
2. Inicie Docker Desktop o Docker Engine en el servidor.
3. Ejecute setup.bat como Administrador.
4. El instalador cargara imagenes desde offline-images y levantara docker-compose.prod.yml sin internet.
5. Valide backups, restore, LAN, impresora y handoff final antes de operar.
======================================================================
"@

Set-Content -LiteralPath (Join-Path $ReleaseRoot "MANIFEST.txt") -Value $manifest -Encoding ASCII

if (-not $SkipGuard) {
    Write-Step "Ejecutando guard de artefacto offline."
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $guardScript -ProjectRoot $ProjectRoot -ReleaseRoot $ReleaseRoot -RequireCurrentCommit
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "El guard de artefacto offline fallo."
    }
}

Write-Host "[OK] Paquete offline preparado en $ReleaseRoot" -ForegroundColor Green
