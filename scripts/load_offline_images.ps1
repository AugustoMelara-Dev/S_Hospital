param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$imagesDir = Join-Path $ProjectRoot "offline-images"
$checksumPath = Join-Path $ProjectRoot "checksums.sha256"

function Write-Fail([string] $message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath $imagesDir -PathType Container)) {
    Write-Fail "No se encontro la carpeta offline-images en el paquete."
}

if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker no esta instalado o no esta en PATH."
}

$tarFiles = @(Get-ChildItem -LiteralPath $imagesDir -Filter "*.tar" -File)
if ($tarFiles.Count -eq 0) {
    Write-Fail "No se encontraron imagenes .tar en offline-images."
}

if (Test-Path -LiteralPath $checksumPath -PathType Leaf) {
    $checksumContent = Get-Content -LiteralPath $checksumPath -Raw
    foreach ($tar in $tarFiles) {
        $relative = "offline-images/$($tar.Name)"
        if ($checksumContent -notmatch [regex]::Escape($relative)) {
            Write-Fail "checksums.sha256 no lista $relative."
        }

        $expected = (($checksumContent -split "\r?\n") | Where-Object { $_ -match [regex]::Escape($relative) } | Select-Object -First 1)
        $expectedHash = ($expected -split "\s+")[0]
        $actualHash = (Get-FileHash -LiteralPath $tar.FullName -Algorithm SHA256).Hash
        if ($actualHash -ne $expectedHash) {
            Write-Fail "Checksum invalido para $relative."
        }
    }
}

foreach ($tar in $tarFiles) {
    Write-Host "[*] Cargando imagen $($tar.Name)..." -ForegroundColor Yellow
    & docker load -i $tar.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Docker no pudo cargar $($tar.Name)."
    }
}

Write-Host "[OK] Imagenes offline cargadas." -ForegroundColor Green
