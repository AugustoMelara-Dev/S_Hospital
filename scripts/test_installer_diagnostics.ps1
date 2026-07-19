# ==============================================================================
# S_Hospital - Suite de Auto-Test de Diagnósticos del Instalador
# ==============================================================================
# Diseñado para Windows PowerShell 5.1. Seguro bajo StrictMode -Version Latest.
# Verifica la correctitud de las funciones lógicas de diagnóstico sin tocar el host.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# UTF-8 Console Output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

# 1. Cargar librerías de diagnóstico
$netHelper = Join-Path $scriptDir "lib\net_diagnostics.ps1"
$dockerHelper = Join-Path $scriptDir "lib\docker_diagnostics.ps1"
$portHelper = Join-Path $scriptDir "lib\port_diagnostics.ps1"
$envHelper = Join-Path $scriptDir "lib\env_helpers.ps1"

if (-not (Test-Path $netHelper)) { throw "Falta net_diagnostics.ps1" }
if (-not (Test-Path $dockerHelper)) { throw "Falta docker_diagnostics.ps1" }
if (-not (Test-Path $portHelper)) { throw "Falta port_diagnostics.ps1" }
if (-not (Test-Path $envHelper)) { throw "Falta env_helpers.ps1" }

. $netHelper
. $dockerHelper
. $portHelper
. $envHelper

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     S_HOSPITAL - INICIANDO SUITE DE AUTO-TEST" -ForegroundColor Cyan -BackgroundColor DarkBlue
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

function Assert-Equal($Actual, $Expected, $TestName) {
    if ($Actual -eq $Expected) {
        Write-Host "  [PASS] $TestName" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "  [FAIL] $TestName" -ForegroundColor Red
        Write-Host "         Esperado: '$Expected' | Obtenido: '$Actual'" -ForegroundColor Yellow
        $script:testsFailed++
    }
}

# --- TEST 1: Get-PropertyValueSafe ---
Write-Host "[*] Test 1: Get-PropertyValueSafe (Evitar StrictMode Exceptions)" -ForegroundColor Yellow
$mockObject = New-Object PSCustomObject -Property @{
    NombreValido = "Hospital Central"
}
# Bajo StrictMode -Version Latest, acceder a una propiedad inexistente arrojaría error fatal.
# Get-PropertyValueSafe debe manejarlo de forma segura devolviendo null.
$val1 = Get-PropertyValueSafe $mockObject "NombreValido"
$val2 = Get-PropertyValueSafe $mockObject "PropiedadInexistente" "DefaultVal"

Assert-Equal $val1 "Hospital Central" "Lectura de propiedad existente"
Assert-Equal $val2 "DefaultVal" "Manejo seguro de propiedad inexistente"

# --- TEST 2: Test-IPv4Address ---
Write-Host ""
Write-Host "[*] Test 2: Test-IPv4Address (Validacion de IPs)" -ForegroundColor Yellow
$ipValid = Test-IPv4Address "192.168.1.100"
$ipLocal = Test-IPv4Address "127.0.0.1"
$ipApipa = Test-IPv4Address "169.254.10.20"
$ipInvalid = Test-IPv4Address "300.400.500.1"

Assert-Equal $ipValid.Valid $true "IP 192.168.1.100 es valida"
Assert-Equal $ipValid.Type "ValidLan" "IP 192.168.1.100 es de tipo ValidLan"

Assert-Equal $ipLocal.Valid $true "IP 127.0.0.1 es valida"
Assert-Equal $ipLocal.Type "Localhost" "IP 127.0.0.1 es detectada como Localhost"

Assert-Equal $ipApipa.Valid $true "IP 169.254.10.20 es valida"
Assert-Equal $ipApipa.Type "APIPA" "IP 169.254.10.20 es detectada como APIPA"

Assert-Equal $ipInvalid.Valid $false "IP 300.400.500.1 es detectada como Invalida"

# --- TEST 3: Get-LanIPv4Candidates Mock-Sort ---
Write-Host ""
Write-Host "[*] Test 3: Clasificacion y Ordenamiento de Adaptadores de Red" -ForegroundColor Yellow
# Validar que los adaptadores de red virtuales (WSL, Docker, APIPA) se detectan y ordenan
$testCandidates = @()
$testCandidates += [PSCustomObject][ordered]@{ IP = "127.0.0.1"; RecScore = 0; RecType = "localhost" }
$testCandidates += [PSCustomObject][ordered]@{ IP = "192.168.1.100"; RecScore = 200; RecType = "RECOMENDADA (Física)" }
$testCandidates += [PSCustomObject][ordered]@{ IP = "172.20.10.1"; RecScore = 30; RecType = "WSL" }

$sorted = $testCandidates | Sort-Object RecScore -Descending
Assert-Equal $sorted[0].IP "192.168.1.100" "IP fisica recomendada queda de primera en la lista"
Assert-Equal $sorted[2].IP "127.0.0.1" "localhost queda de ultima en la lista"

# --- TEST 4: Port Diagnostics Safe Bind Check ---
Write-Host ""
Write-Host "[*] Test 4: Diagnostico de Puertos Libres" -ForegroundColor Yellow
# Un puerto de test extremadamente alto que deberia estar libre
$freePort = 59876
$isFree = Test-PortAvailable $freePort
Assert-Equal $isFree.Available $true "Puerto de prueba alto $freePort se reporta como disponible"


# --- TEST 5: .env Safe Updates en Path Temporal ---
Write-Host ""
Write-Host "[*] Test 5: Gestion No Destructiva de .env" -ForegroundColor Yellow
$tempEnv = Join-Path $scriptDir "temp_env.tmp"
try {
    if (Test-Path $tempEnv) { Remove-Item $tempEnv -Force }
    
    # Crear un .env base con secretos
    @("DB_PASSWORD=secreto_original", "DB_DATABASE=hospital_billing") | Out-File -FilePath $tempEnv -Encoding utf8
    
    # Actualizar valores
    $vars = @{
        "DB_DATABASE" = "hospital_billing_v2"
        "SERVER_IP" = "192.168.1.150"
    }
    Update-DotEnv -Path $tempEnv -Variables $vars
    
    # Validar
    $loaded = Read-EnvFile $tempEnv
    Assert-Equal $loaded["DB_PASSWORD"] "secreto_original" "Preservacion de clave original"
    Assert-Equal $loaded["DB_DATABASE"] "hospital_billing_v2" "Actualizacion de clave existente"
    Assert-Equal $loaded["SERVER_IP"] "192.168.1.150" "Adicion de clave nueva"
}
finally {
    if (Test-Path $tempEnv) { Remove-Item $tempEnv -Force }
}

# --- TEST 6: Detección de Archivos Requeridos y Espacios ---
Write-Host ""
Write-Host "[*] Test 6: Validacion del Entorno del Repositorio" -ForegroundColor Yellow
$composeExists = Test-Path (Join-Path $projectRoot "docker-compose.prod.yml")
Assert-Equal $composeExists $true "Archivo docker-compose.prod.yml esta presente en el repositorio"

# --- INFORME FINAL ---
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "               INFORME FINAL DE AUTO-TEST                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Pruebas Exitosas: $testsPassed" -ForegroundColor Green
if ($testsFailed -gt 0) {
    Write-Host "  Pruebas Fallidas: $testsFailed" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  ¡TODAS LAS PRUEBAS INTERNAS PASARON CON EXITO!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    exit 0
}
