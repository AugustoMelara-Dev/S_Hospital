# ==============================================================================
# Sistema de Caja Hospitalaria - Quick Check Post-Instalacion
# ==============================================================================
# Validacion rapida y sin autenticacion que el deploy_hospital_lan.ps1
# invoca al final de la instalacion. Complementa al smoke test
# completo (smoke_test_post_install.ps1) que si requiere login.
#
# Solo verifica que el stack respondio y los headers de seguridad
# basicos estan presentes. No crea ni modifica datos.
#
# Salida:
#   0  -> todos los checks criticos pasaron
#   1  -> al menos un check fallo
# ------------------------------------------------------------------------------

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string] $BaseUrl = "http://127.0.0.1:8000",

    [Parameter(Mandatory = $false)]
    [int] $TimeoutSec = 20
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')

$script:results = New-Object System.Collections.Generic.List[object]
$script:failed = 0

function Add-Check {
    param(
        [string] $Name,
        [bool] $Ok,
        [string] $Detail = ""
    )
    $script:results.Add([pscustomobject]@{
        Check = $Name
        Status = if ($Ok) { "PASS" } else { "FAIL" }
        Detail = $Detail
    }) | Out-Null
    if (-not $Ok) {
        $script:failed++
    }
}

Write-Host "==================================================================="
Write-Host " S_Hospital - Quick check post-instalacion"
Write-Host " Base URL: $BaseUrl"
Write-Host "==================================================================="

# 1. /up responde 200
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/up" -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    Add-Check -Name "GET /up responde 200" -Ok ($r.StatusCode -eq 200) -Detail "HTTP $($r.StatusCode)"
} catch {
    Add-Check -Name "GET /up responde 200" -Ok $false -Detail $_.Exception.Message
}

# 2. /api/health responde JSON con status ok
try {
    $h = Invoke-RestMethod -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    $ok = $h.status -eq 'ok' -and ($h.service -match 'Caja Hospitalaria')
    Add-Check -Name "GET /api/health JSON" -Ok $ok -Detail "status=$($h.status) service=$($h.service)"
} catch {
    Add-Check -Name "GET /api/health JSON" -Ok $false -Detail $_.Exception.Message
}

# 3. /api/system/health responde (con o sin auth)
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/system/health" -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    Add-Check -Name "GET /api/system/health" -Ok $true -Detail "HTTP $($r.StatusCode)"
} catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    if ($code -in 200, 401, 403) {
        Add-Check -Name "GET /api/system/health" -Ok $true -Detail "HTTP $code (endpoint alcanzable)"
    } else {
        Add-Check -Name "GET /api/system/health" -Ok $false -Detail "HTTP $code"
    }
}

# 4. /login sirve la SPA
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/login" -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    Add-Check -Name "GET /login sirve SPA" -Ok ($r.StatusCode -eq 200) -Detail "HTTP $($r.StatusCode)"
} catch {
    Add-Check -Name "GET /login sirve SPA" -Ok $false -Detail $_.Exception.Message
}

# 5. Frontend dist presente
try {
    $indexHtml = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    $hasScript = $indexHtml.Content -match '<script[^>]+src="[^"]*assets/[^"]+\.js"'
    Add-Check -Name "Frontend dist compilado" -Ok $hasScript -Detail "Asset JS detectado en /"
} catch {
    Add-Check -Name "Frontend dist compilado" -Ok $false -Detail $_.Exception.Message
}

# 6. POST /api/auth/login con body vacio -> 422 o 429
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -UseBasicParsing -TimeoutSec $TimeoutSec `
        -Headers @{"Content-Type" = "application/json"; "Accept" = "application/json"} `
        -Body "{}" -ErrorAction Stop
    Add-Check -Name "POST /api/auth/login valida body" -Ok $false -Detail "HTTP $($r.StatusCode) esperado 422"
} catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    if ($code -in 422, 429) {
        Add-Check -Name "POST /api/auth/login valida body" -Ok $true -Detail "HTTP $code"
    } else {
        Add-Check -Name "POST /api/auth/login valida body" -Ok $false -Detail "HTTP $code"
    }
}

# 7. Headers de seguridad basicos
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/up" -Method Head -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    $hasCsp = $r.Headers.ContainsKey('Content-Security-Policy')
    $hasXcto = $r.Headers.ContainsKey('X-Content-Type-Options')
    Add-Check -Name "Headers de seguridad presentes" -Ok ($hasCsp -and $hasXcto) -Detail "CSP=$hasCsp X-Content-Type-Options=$hasXcto"
} catch {
    Add-Check -Name "Headers de seguridad presentes" -Ok $false -Detail $_.Exception.Message
}

Write-Host ""
$script:results | Format-Table -AutoSize | Out-String | Write-Host

if ($script:failed -gt 0) {
    Write-Host "FALLARON $script:failed verificacion(es)." -ForegroundColor Red
    Write-Host "Revise los logs del stack antes de continuar."
    exit 1
}

Write-Host "Todos los checks criticos pasaron." -ForegroundColor Green
exit 0
