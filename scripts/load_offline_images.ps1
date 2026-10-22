# ==============================================================================
# S_Hospital - Cargador de Imágenes Docker Offline
# ==============================================================================
# Este script se ejecuta en el servidor del hospital.
# Busca y carga las imágenes Docker exportadas en la carpeta offline-images/.
# Antes de cargar, verifica el SHA-256 de cada archivo contra checksums.sha256
# y contra el sidecar <imagen>.tar.sha256. Falla cerrado si falta el manifiesto,
# falta un sidecar o hay cualquier diferencia de hash.
# Integridad no equivale a autenticidad: el hash detecta alteración del paquete,
# no demuestra por sí solo la procedencia del USB.

param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# UTF-8 Console Output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "     [S_HOSPITAL - INSTALADOR DE IMAGENES OFFLINE]                  " -ForegroundColor Cyan -BackgroundColor DarkBlue
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
else {
    $projectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}
$imagesDir = Join-Path $projectRoot "offline-images"
$checksumManifestPath = Join-Path $projectRoot "checksums.sha256"

function Get-SidecarImageHash([string] $SidecarPath) {
    if (-not (Test-Path -LiteralPath $SidecarPath -PathType Leaf)) {
        return $null
    }

    $raw = Get-Content -LiteralPath $SidecarPath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    $tokens = @($raw.Trim() -split '\s+' | Where-Object { $_ -ne "" })
    if ($tokens.Count -eq 0) {
        return $null
    }

    $candidate = [string] $tokens[0]
    if ($candidate -notmatch '^[0-9a-fA-F]{64}$') {
        return $null
    }

    return $candidate.ToLowerInvariant()
}

function Get-ManifestImageHash([string] $ManifestPath, [string] $RelativePath) {
    $expected = $null

    foreach ($line in (Get-Content -LiteralPath $ManifestPath)) {
        $trimmed = ([string] $line).TrimStart([char] 0xFEFF).Trim()
        if ($trimmed -eq "") {
            continue
        }

        $match = [regex]::Match($trimmed, '^([0-9a-fA-F]{64})\s+(.+?)\s*$')
        if (-not $match.Success) {
            continue
        }

        $candidatePath = $match.Groups[2].Value.Trim().Replace('\', '/')
        if ($candidatePath -ieq $RelativePath) {
            $expected = $match.Groups[1].Value.ToLowerInvariant()
        }
    }

    return $expected
}

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

# 2. Listar archivos .tar y verificar integridad ANTES de cargar
$tarFiles = Get-ChildItem -Path $imagesDir -Filter "*.tar"
if ($tarFiles.Count -eq 0) {
    Write-Host "[FAIL] No se encontraron archivos .tar en el directorio $imagesDir" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Se encontraron $($tarFiles.Count) imagenes offline para cargar." -ForegroundColor Yellow
Write-Host "[*] Verificando integridad SHA-256 antes de cargar..." -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path -LiteralPath $checksumManifestPath -PathType Leaf)) {
    Write-Host "[FAIL] Falta el manifiesto de checksums: $checksumManifestPath" -ForegroundColor Red
    Write-Host "       No se cargara ninguna imagen sin el manifiesto de integridad." -ForegroundColor Red
    exit 1
}

$integrityErrors = New-Object System.Collections.Generic.List[string]

foreach ($tar in $tarFiles) {
    $relative = "offline-images/$($tar.Name)"
    $sidecarPath = "$($tar.FullName).sha256"
    $actualHash = (Get-FileHash -LiteralPath $tar.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

    $sidecarHash = Get-SidecarImageHash -SidecarPath $sidecarPath
    if ($null -eq $sidecarHash) {
        if (Test-Path -LiteralPath $sidecarPath -PathType Leaf) {
            $integrityErrors.Add("$relative : el archivo $($tar.Name).sha256 no contiene un SHA-256 valido. Hash actual: $actualHash.")
        }
        else {
            $integrityErrors.Add("$relative : falta el checksum individual $($tar.Name).sha256. Hash actual: $actualHash.")
        }
        continue
    }

    if ($sidecarHash -ne $actualHash) {
        $integrityErrors.Add("$relative : checksum individual no coincide. Esperado: $sidecarHash / Actual: $actualHash.")
        continue
    }

    $manifestHash = Get-ManifestImageHash -ManifestPath $checksumManifestPath -RelativePath $relative
    if ($null -eq $manifestHash) {
        $integrityErrors.Add("$relative : no aparece en checksums.sha256. Hash actual: $actualHash.")
        continue
    }

    if ($manifestHash -ne $actualHash) {
        $integrityErrors.Add("$relative : checksums.sha256 no coincide. Esperado: $manifestHash / Actual: $actualHash.")
        continue
    }

    Write-Host "[OK] Integridad verificada: $relative ($actualHash)" -ForegroundColor Green
}

if ($integrityErrors.Count -gt 0) {
    Write-Host ""
    foreach ($integrityError in $integrityErrors) {
        Write-Host "[FAIL] $integrityError" -ForegroundColor Red
    }
    Write-Host "[FAIL] Se aborta la carga: ninguna imagen se cargara hasta corregir los checksums." -ForegroundColor Red
    exit 1
}

Write-Host "[*] Integridad verificada de $($tarFiles.Count) imagenes. La verificacion detecta alteracion del paquete; no sustituye una firma de origen confiable." -ForegroundColor Gray
Write-Host ""

# 3. Cargar imagenes (solo despues de verificar todas)
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

# 4. Validar disponibilidad de las imágenes requeridas
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
