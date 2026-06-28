param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

Write-Host 'Sistema de Caja Hospitalaria - diagnostico no destructivo'
Write-Host "Proyecto: $ProjectRoot"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host 'Docker no esta instalado o no esta en PATH.'
    exit 1
}

try {
    docker info | Out-Null
} catch {
    Write-Host 'Docker esta instalado pero no responde. Inicie Docker Desktop.'
    exit 1
}

Push-Location $ProjectRoot
try {
    Write-Host ''
    Write-Host 'Contenedores:'
    docker compose ps

    Write-Host ''
    Write-Host 'Ultimos logs backend/mysql:'
    docker compose logs --tail=80 backend mysql

    Write-Host ''
    Write-Host 'Estado de migraciones:'
    docker compose exec -T backend php artisan migrate:status
} finally {
    Pop-Location
}
