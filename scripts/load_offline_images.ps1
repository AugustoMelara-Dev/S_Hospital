# ==============================================================================
# S_Hospital - Cargador de Imágenes Docker Offline
# ==============================================================================
# Este script se ejecuta en el servidor del hospital.
# Busca y carga las imágenes Docker exportadas en la carpeta offline-images/.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# UTF-8 Console Output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "     [S_HOSPITAL - INSTALADOR DE IMAGENES OFFLINE]                  " -ForegroundColor Cyan -BackgroundColor DarkBlue
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$imagesDir = Join-Path $projectRoot "offline-images"

if (-not (Test-Path $imagesDir)) {
    Write-Host "[FAIL] No se encontró el directorio de imágenes offline en: $imagesDir" -ForegroundColor Red
    exit 1
}

# 1. Validar Docker
$dockerInstalled = $null -ne (Get-Command "docker" -ErrorAction SilentlyContinue)
if (-not $dockerInstalled) {
    Write-Host "[FAIL] Docker no está instalado en este servidor. Por favor, instale Docker Desktop antes de continuar." -ForegroundColor Red
    exit 1
}

$dockerCheck = docker ps 2>&1
if ($dockerCheck -match "error" -or $LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] El servicio de Docker no está en ejecución. Por favor, inicie Docker Desktop y vuelva a intentar." -ForegroundColor Red
    exit 1
}

# 2. Listar archivos .tar y cargarlos
$tarFiles = Get-ChildItem -Path $imagesDir -Filter "*.tar"
if ($tarFiles.Count -eq 0) {
    Write-Host "[FAIL] No se encontraron archivos .tar en el directorio $imagesDir" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Se encontraron $($tarFiles.Count) imagenes offline para cargar." -ForegroundColor Yellow
Write-Host ""

foreach ($tar in $tarFiles) {
    Write-Host "[*] Cargando imagen desde $($tar.Name)..." -ForegroundColor Yellow
    
    # Ejecutamos docker load
    $loadResult = docker load -i $tar.FullName
    Write-Host $loadResult -ForegroundColor Gray
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Error al cargar la imagen de $($tar.Name)." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Imagen de $($tar.Name) cargada correctamente." -ForegroundColor Green
    Write-Host ""
}

# 3. Validar disponibilidad de las imágenes requeridas
Write-Host "[*] Validando disponibilidad en el registro local de Docker..." -ForegroundColor Yellow
$localImages = docker images --format "{{.Repository}}:{{.Tag}}"

$requiredImages = @(
    "s_hospital-prod-backend:latest",
    "s_hospital-prod-queue-worker:latest",
    "s_hospital-prod-scheduler:latest",
    "nginx:1.25.4-alpine",
    "mariadb:11.4.3",
    "quay.io/soketi/soketi:1.6-16-alpine"
)
$missingImages = @()

foreach ($requiredImage in $requiredImages) {
    if ($localImages -contains $requiredImage) {
        Write-Host "[OK] Imagen confirmada: $requiredImage" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] Falta la imagen requerida: $requiredImage" -ForegroundColor Red
        $missingImages += $requiredImage
    }
}

if ($missingImages.Count -gt 0) {
    Write-Host ""
    Write-Host "[FAIL] El paquete offline esta incompleto. No se intentara iniciar con descargas de internet." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[SUCCESS] Todas las imagenes requeridas estan cargadas y listas en el servidor." -ForegroundColor Green

Write-Host "======================================================================" -ForegroundColor Cyan
