# ==============================================================================
# S_Hospital - Generador de Paquete de Instalación Offline
# ==============================================================================
# Este script se ejecuta en una máquina con acceso a internet.
# Compila e instala de forma local las imágenes Docker de producción y las exporta
# a archivos .tar en la carpeta offline-release/.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# UTF-8 Console Output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "     [S_HOSPITAL - CREADOR DE PAQUETE OFFLINE]                      " -ForegroundColor Cyan -BackgroundColor DarkBlue
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Validar Docker
Write-Host "[*] Validando disponibilidad de Docker..." -ForegroundColor Yellow
$dockerInstalled = $null -ne (Get-Command "docker" -ErrorAction SilentlyContinue)
if (-not $dockerInstalled) {
    Write-Host "[FAIL] Docker no está instalado en este equipo de desarrollo. Se requiere Docker para compilar y guardar imágenes." -ForegroundColor Red
    exit 1
}

$dockerCheck = docker ps 2>&1
if ($dockerCheck -match "error" -or $LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Docker está instalado pero no se encuentra en ejecución. Inicie Docker Desktop primero." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Docker está corriendo." -ForegroundColor Green

# Variables de rutas
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$releaseDir = Join-Path $projectRoot "offline-release"
$imagesDir = Join-Path $releaseDir "offline-images"

# Limpiar o crear directorios de destino
if (Test-Path $releaseDir) {
    Write-Host "[*] Limpiando carpeta offline-release existente..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $releaseDir -ErrorAction SilentlyContinue
}
$null = New-Item -ItemType Directory -Force -Path $releaseDir
$null = New-Item -ItemType Directory -Force -Path $imagesDir

# 2. Compilar imágenes de producción
Write-Host "[*] Construyendo imágenes de producción con Docker Compose..." -ForegroundColor Yellow
# Definir variables de entorno ficticias requeridas por el compose para validar sintaxis de docker compose build
$env:SERVER_IP = "127.0.0.1"
$env:APP_KEY = "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
$env:DB_PASSWORD = "password"
$env:DB_ROOT_PASSWORD = "root_password"
$env:HOSPITAL_BACKUP_ENCRYPTION_KEY = "base64:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
$env:PUSHER_APP_ID = "offline-build"
$env:PUSHER_APP_KEY = "offline-build-key"
$env:PUSHER_APP_SECRET = "offline-build-secret"

$composePath = Join-Path $projectRoot "docker-compose.prod.yml"
docker compose -f $composePath build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Falló la construcción de las imágenes de Docker Compose." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Construcción de imágenes completada con éxito." -ForegroundColor Green

$runtimeImages = @(
    "nginx:1.25.4-alpine@sha256:31bad00311cb5eeb8a6648beadcf67277a175da89989f14727420a80e2e76742",
    "mariadb:11.4.3@sha256:e3432369d4d432ec2a3d777ff84ffca11ec8c2188cf1b6a0551a393ae5d833bb",
    "quay.io/soketi/soketi:1.6-16-alpine@sha256:5e45fe1adbf2d4ef8022d0126a3c7e4371b7b08f35784b76a2dc353954ee885c"
)
foreach ($runtimeImage in $runtimeImages) {
    Write-Host "[*] Descargando imagen runtime $runtimeImage..." -ForegroundColor Yellow
    docker pull $runtimeImage
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] No se pudo descargar $runtimeImage para el paquete offline." -ForegroundColor Red
        exit 1
    }
}

# 3. Detectar nombres reales de las imágenes y guardarlas
Write-Host "[*] Detectando y exportando imágenes..." -ForegroundColor Yellow

# Guardar todas las imagenes que docker-compose.prod.yml necesita. Los nombres
# exactos conservan las etiquetas que Compose buscara en el servidor offline.
$imagesToSave = @(
    @{ Image = "s_hospital-backend:latest"; Target = "backend.tar" }
    @{ Image = "s_hospital-queue-worker:latest"; Target = "queue-worker.tar" }
    @{ Image = "s_hospital-scheduler:latest"; Target = "scheduler.tar" }
    @{ Image = "nginx:1.25.4-alpine"; Target = "nginx.tar" }
    @{ Image = "mariadb:11.4.3"; Target = "mariadb.tar" }
    @{ Image = "quay.io/soketi/soketi:1.6-16-alpine"; Target = "soketi.tar" }
)

foreach ($item in $imagesToSave) {
    $img = $item.Image
    $tgt = Join-Path $imagesDir $item.Target

    docker image inspect $img *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] La imagen requerida no existe localmente: $img" -ForegroundColor Red
        exit 1
    }

    Write-Host "[*] Exportando $img a $tgt..." -ForegroundColor Yellow
    docker save -o $tgt $img
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Falló exportación de la imagen $img." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Guardada exitosamente." -ForegroundColor Green
}

# 4. Copiar archivos del repositorio necesarios para la ejecución
Write-Host "[*] Copiando archivos de código y configuración al paquete de release..." -ForegroundColor Yellow

$dirsToCopy = @("nginx", "scripts")
$filesToCopy = @("setup.bat", "docker-compose.prod.yml", ".env.example", "README.md")

foreach ($dir in $dirsToCopy) {
    $srcDir = Join-Path $projectRoot $dir
    $destDir = Join-Path $releaseDir $dir
    if (Test-Path $srcDir) {
        Copy-Item -Path $srcDir -Destination $destDir -Recurse -Force
    }
}

foreach ($file in $filesToCopy) {
    $srcFile = Join-Path $projectRoot $file
    $destFile = Join-Path $releaseDir $file
    if (Test-Path $srcFile) {
        Copy-Item -Path $srcFile -Destination $destFile -Force
    }
}

# Copiar selectivamente Dockerfile.prod de backend (creando el árbol necesario)
$destBackendDir = Join-Path $releaseDir "backend"
$null = New-Item -ItemType Directory -Force -Path $destBackendDir
Copy-Item -Path (Join-Path $projectRoot "backend\Dockerfile.prod") -Destination (Join-Path $destBackendDir "Dockerfile.prod") -Force

# Copiar selectivamente .env.production de frontend
$destFrontendDir = Join-Path $releaseDir "frontend"
$null = New-Item -ItemType Directory -Force -Path $destFrontendDir
Copy-Item -Path (Join-Path $projectRoot "frontend\.env.production") -Destination (Join-Path $destFrontendDir ".env.production") -Force

# Copiar documentación
$destDocsDir = Join-Path $releaseDir "docs"
$null = New-Item -ItemType Directory -Force -Path $destDocsDir
if (Test-Path (Join-Path $projectRoot "docs")) {
    Copy-Item -Path (Join-Path $projectRoot "docs\*") -Destination $destDocsDir -Recurse -Force
}

# 5. Generar Checksums SHA256 para cada imagen
Write-Host "[*] Generando checksums SHA256..." -ForegroundColor Yellow
$checksums = @()
$tarFiles = Get-ChildItem -Path $imagesDir -Filter "*.tar"
foreach ($tar in $tarFiles) {
    Write-Host "  -> Calculando hash para $($tar.Name)..." -ForegroundColor Gray
    $hash = (Get-FileHash -Path $tar.FullName -Algorithm SHA256).Hash
    $checksums += "$hash  offline-images/$($tar.Name)"
    # Generar archivo hash individual
    $individualHashFile = "$($tar.FullName).sha256"
    $hash | Out-File -FilePath $individualHashFile -Encoding utf8
}
$checksumFile = Join-Path $releaseDir "checksums.sha256"
$checksums | Out-File -FilePath $checksumFile -Encoding utf8
Write-Host "[OK] Hashes generados y guardados en checksums.sha256 y archivos individuales *.tar.sha256" -ForegroundColor Green

# 6. Crear el archivo MANIFEST.txt
Write-Host "[*] Creando MANIFEST.txt..." -ForegroundColor Yellow
$manifestPath = Join-Path $releaseDir "MANIFEST.txt"

# Obtener información de Git
$gitCommit = "N/A (Git no disponible)"
try {
    $gitCommit = (git rev-parse HEAD 2>$null).Trim()
} catch {}

$gitBranch = "N/A (Git no disponible)"
try {
    $gitBranch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
} catch {}

$tarList = @()
$totalSizeBytes = 0
foreach ($tar in $tarFiles) {
    $sizeMB = [Math]::Round($tar.Length / 1MB, 2)
    $totalSizeBytes += $tar.Length
    $tarList += "- $($tar.Name): $($sizeMB) MB"
}
$totalSizeMB = [Math]::Round($totalSizeBytes / 1MB, 2)

$manifestContent = @"
======================================================================
S_HOSPITAL - OFFLINE RELEASE MANIFEST
======================================================================
Fecha de Generacion : $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Rama Git            : $gitBranch
Commit Git          : $gitCommit
Tamaño Total Images : $totalSizeMB MB

IMAGENES INCLUIDAS:
$( $tarList -join "`r`n" )

INSTRUCCIONES RAPIDAS DE INSTALACION:
1. Copie todo el contenido de la carpeta 'offline-release' a la PC Servidor.
2. Inicie Docker Desktop en el Servidor.
3. Haga clic derecho sobre 'setup.bat' y seleccione 'Ejecutar como administrador'.
4. Seleccione la opcion [1] (Docker) en el instalador.
5. El instalador detectara automaticamente la carpeta 'offline-images/' e
   importara todas las imagenes usando 'docker load' de manera offline.
======================================================================
"@

$manifestContent | Out-File -FilePath $manifestPath -Encoding utf8
Write-Host "[OK] MANIFEST.txt creado con éxito." -ForegroundColor Green

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] PAQUETE OFFLINE GENERADO CON EXITO EN:" -ForegroundColor Green -BackgroundColor DarkGreen
Write-Host " -> $releaseDir" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
