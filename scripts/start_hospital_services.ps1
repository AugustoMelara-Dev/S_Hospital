param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch] $WhatIf
)

$ErrorActionPreference = 'Stop'
Set-Location $ProjectRoot

Write-Host 'Iniciando servicios locales del Sistema de Caja Hospitalaria...'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no esta instalado o no esta disponible en PATH.'
}

if ($WhatIf) {
    Write-Host 'WHATIF: docker compose up -d backend frontend mysql'
    exit 0
}

docker compose up -d backend frontend mysql

Write-Host 'Servicios solicitados sin borrar datos. Puede abrir el sistema con scripts\open_hospital_system.ps1.'
Write-Host 'Si el sistema no abre, ejecute scripts\repair_hospital_system.ps1 para generar un diagnostico de soporte.'
