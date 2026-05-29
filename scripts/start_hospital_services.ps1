param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location $ProjectRoot

Write-Host 'Iniciando servicios locales del Sistema de Caja Hospitalaria...'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta instalado o no esta disponible en PATH.'
}

docker compose up -d backend frontend mysql

Write-Host 'Servicios solicitados. Puede abrir el sistema con scripts\open_hospital_system.ps1.'
