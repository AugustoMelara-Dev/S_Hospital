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

# Imágenes requeridas
# Nota: s_hospital-backend y s_hospital-queue-worker se listarán de acuerdo al ID cargado o al tag.
# Al importar de docker load, mantienen sus tags originales (ej. s_hospital-backend:latest o con hashes).
# Verificamos simplemente que existan palabras clave si no podemos garantizar el prefijo exacto.
$requiredKeywords = @("backend", "queue-worker", "nginx", "mariadb")
$missingCount = 0

foreach ($keyword in $requiredKeywords) {
    $matched = $localImages | Where-Object { $_ -match $keyword }
    if ($matched) {
        Write-Host "[OK] Imagen para '$keyword' confirmada: $($matched -join ', ')" -ForegroundColor Green
    } else {
        Write-Host "[WARN] No se detectó ninguna imagen cargada que coincida con '$keyword'." -ForegroundColor Yellow
        $missingCount++
    }
}

if ($missingCount -gt 0) {
    Write-Host ""
    Write-Host "[WARN] Algunas imagenes recomendadas no fueron encontradas. Es posible que el arranque falle si no hay internet." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "[SUCCESS] Todas las imagenes requeridas se encuentran cargadas y listas en el servidor." -ForegroundColor Green
}

Write-Host "======================================================================" -ForegroundColor Cyan
