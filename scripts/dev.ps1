<#
.SYNOPSIS
  Prepara y arranca S_Hospital v2 en modo desarrollo (Windows).
.DESCRIPTION
  - Crea api/.venv e instala dependencias si faltan.
  - Instala dependencias web si faltan.
  - Migra y siembra datos de demostración (SQLite en api/storage/dev.db).
  - Abre la API en :8000 y Vite en :5173 en dos ventanas.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
#>
param([switch]$NoDemo)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root 'api'
$web = Join-Path $root 'web'
$py = Join-Path $api '.venv\Scripts\python.exe'

if (-not (Test-Path $py)) {
  Write-Host '[api] creando entorno virtual...'
  python -m venv (Join-Path $api '.venv')
  & $py -m pip install -r (Join-Path $api 'requirements-dev.txt')
}
if (-not (Test-Path (Join-Path $web 'node_modules'))) {
  Write-Host '[web] instalando dependencias...'
  Push-Location $web; npm ci; Pop-Location
}

Push-Location $api
& $py -m app.cli migrate
if ($NoDemo) { & $py -m app.cli seed } else { & $py -m app.cli seed --demo }
Pop-Location

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$api'; & '$py' -m app.cli serve --reload"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$web'; npm run dev"
Write-Host ''
Write-Host 'API:  http://localhost:8000/api/docs'
Write-Host 'Web:  http://localhost:5173   (usuarios demo: admin / cajero / supervisor / auditor, clave Hospital#2026)'
