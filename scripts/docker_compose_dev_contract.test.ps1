$ErrorActionPreference = "Stop"

$composePath = Join-Path (Split-Path $PSScriptRoot -Parent) "docker-compose.yml"
$content = Get-Content -LiteralPath $composePath -Raw

function Assert-Contains([string] $needle, [string] $message) {
    if (-not $content.Contains($needle)) {
        throw $message
    }
}

function Assert-NotContains([string] $needle, [string] $message) {
    if ($content.Contains($needle)) {
        throw $message
    }
}

Assert-Contains `
    'HOSPITAL_BACKUP_ENCRYPTION_KEY: ${HOSPITAL_BACKUP_ENCRYPTION_KEY:?HOSPITAL_BACKUP_ENCRYPTION_KEY is required}' `
    "Development backend must receive the persistent backup encryption key."

Assert-Contains `
    'command: sh -c "npm ci && npm run dev -- --host 0.0.0.0"' `
    "Development frontend must install exactly from package-lock.json."

Assert-NotContains `
    'command: sh -c "npm install && npm run dev -- --host 0.0.0.0"' `
    "Development frontend must not rewrite package-lock.json at startup."

$lockPath = Join-Path (Split-Path $PSScriptRoot -Parent) "frontend\package-lock.json"
$lockContent = Get-Content -LiteralPath $lockPath -Raw

foreach ($linuxPackage in @("node_modules/@emnapi/core", "node_modules/@emnapi/runtime")) {
    if (-not $lockContent.Contains('"' + $linuxPackage + '": {')) {
        throw "package-lock.json must include Linux optional package: $linuxPackage"
    }
}

Write-Host "[ OK ] development compose keeps backups recoverable and frontend installs reproducible"
