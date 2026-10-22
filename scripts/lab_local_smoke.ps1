#Requires -Version 5.1
<#
.SYNOPSIS
    Prueba end-to-end real del laboratorio local NO-Docker y guarda evidencia.

.DESCRIPTION
    Ejecuta el flujo HTTP completo (sin mocks, sin Docker) contra los procesos
    que levanto scripts\lab_local_up.ps1:

      1. GET  /api/health                      (backend directo)
      2. GET  /api/system/health               (marca APP_VERSION=lab-local)
      3. GET  /sanctum/csrf-cookie             (cookie XSRF)
      4. POST /api/auth/login                  (usuario sintetico del seeder)
      5. GET  /api/auth/me                     (sesion autenticada)
      6. GET  /api/services                    (endpoint autenticado con datos)
      7. GET  /                                (frontend servido por Vite)
      8. GET  /@vite/client                    (cliente Vite activo)
      9. GET  /api/health via proxy del frontend
     10. GET  /api/system/health via proxy -> debe reportar version lab-local
     11. GET  /api/auth/me sin cookies         (control negativo: 401)

    Todo el trafico se hace con curl.exe sobre 127.0.0.1. No se usan datos
    reales ni secretos de produccion; la contrasena del usuario sintetico no se
    imprime ni se guarda.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\lab_local_smoke.ps1
#>
param(
    [string] $ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [int] $BackendPort = 0,
    [int] $FrontendPort = 0,
    [string] $Login = 'admin.validacion',
    [string] $Password = 'Password123!',
    [string] $CurlExe = 'curl.exe'
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'lib\lab_local.ps1')

$projectRoot = Assert-LabLocalRoot -ProjectRoot $ProjectRoot
$paths = Get-LabLocalPaths -ProjectRoot $projectRoot

$state = Read-LabLocalState -StateFile $paths.StateFile
if ($BackendPort -le 0) {
    if ($null -ne $state -and [int] $state.backend_port -gt 0) { $BackendPort = [int] $state.backend_port } else { $BackendPort = $script:LabLocalDefaultBackendPort }
}
if ($FrontendPort -le 0) {
    if ($null -ne $state -and [int] $state.frontend_port -gt 0) { $FrontendPort = [int] $state.frontend_port } else { $FrontendPort = $script:LabLocalDefaultFrontendPort }
}

$apiBase = "http://127.0.0.1:$BackendPort"
$webBase = "http://127.0.0.1:$FrontendPort"

$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$runRoot = Join-Path $paths.EvidenceRoot ('smoke-' + $runId)
$bodyRoot = Join-Path $runRoot 'responses'
New-Item -ItemType Directory -Path $bodyRoot -Force | Out-Null

$cookieJar = Join-Path $runRoot 'cookies.txt'
$checks = New-Object System.Collections.ArrayList

function Invoke-LabCurlRequest {
    param(
        [Parameter(Mandatory = $true)][string] $Name,
        [Parameter(Mandatory = $true)][string] $Method,
        [Parameter(Mandatory = $true)][string] $Url,
        [string[]] $Headers = @(),
        [string] $JsonBody = '',
        [string] $CookieJarPath = '',
        [switch] $UseCookieJar,
        [int] $TimeoutSeconds = 60
    )

    $outFile = Join-Path $bodyRoot ($Name + '.body.txt')
    $curlArguments = @(
        '-s', '-o', $outFile, '-w', '%{http_code}',
        '--noproxy', '127.0.0.1,localhost',
        '--max-time', [string] $TimeoutSeconds,
        '-X', $Method
    )

    if (-not [string]::IsNullOrWhiteSpace($CookieJarPath)) {
        $curlArguments += @('-b', $CookieJarPath)
        if ($UseCookieJar) { $curlArguments += @('-c', $CookieJarPath) }
    }

    $bodyFile = ''
    if (-not [string]::IsNullOrWhiteSpace($JsonBody)) {
        # El cuerpo real se envia desde un archivo TEMPORAL fuera de la
        # evidencia; en la evidencia queda solo una copia redactada, para no
        # persistir la contrasena ni ningun otro valor sensible.
        $bodyFile = Join-Path ([System.IO.Path]::GetTempPath()) ('lab-local-' + $Name + '-' + [guid]::NewGuid().ToString('N') + '.json')
        Set-LabLocalFileText -Path $bodyFile -Content $JsonBody

        $redacted = $JsonBody -replace '("password"\s*:\s*)"[^"]*"', '$1"<redacted>"'
        Set-LabLocalFileText -Path (Join-Path $runRoot ($Name + '.request.redacted.json')) -Content $redacted

        $curlArguments += @('-H', 'Content-Type: application/json', '--data-binary', ('@' + $bodyFile))
    }

    foreach ($header in $Headers) {
        $curlArguments += @('-H', $header)
    }

    $curlArguments += $Url

    $raw = & $CurlExe @curlArguments 2>$null
    $status = 0
    [void] [int]::TryParse(([string] ($raw -join '')).Trim(), [ref] $status)

    # El archivo temporal con el cuerpo real (posible contrasena) no se conserva.
    if (-not [string]::IsNullOrWhiteSpace($bodyFile) -and (Test-Path -LiteralPath $bodyFile)) {
        Remove-Item -LiteralPath $bodyFile -Force -ErrorAction SilentlyContinue
    }

    $body = ''
    if (Test-Path -LiteralPath $outFile) {
        $body = Get-Content -LiteralPath $outFile -Raw -ErrorAction SilentlyContinue
    }

    return [pscustomobject]@{
        Name     = $Name
        Method   = $Method
        Url      = $Url
        Status   = $status
        Body     = [string] $body
        BodyFile = $outFile
    }
}

function Add-LabCheck {
    param(
        [Parameter(Mandatory = $true)][string] $Name,
        [Parameter(Mandatory = $true)][bool] $Passed,
        [Parameter(Mandatory = $true)][string] $Detail
    )

    [void] $checks.Add([pscustomobject]@{
        check  = $Name
        passed = $Passed
        detail = $Detail
    })

    $color = 'Red'
    $label = 'FAIL'
    if ($Passed) { $color = 'Green'; $label = 'PASS' }

    Write-Host ("  [{0}] {1} - {2}" -f $label, $Name, $Detail) -ForegroundColor $color
}

Write-Host ''
Write-Host '=== S_Hospital - LAB LOCAL SMOKE (NO-DOCKER) ===' -ForegroundColor Cyan
Write-Host "Backend : $apiBase"
Write-Host "Frontend: $webBase"
Write-Host "Evidencia: $runRoot"
Write-Host ''

$acceptJson = 'Accept: application/json'

# -- 1. Liveness directo del backend -----------------------------------------
$health = Invoke-LabCurlRequest -Name '01-backend-health' -Method 'GET' -Url "$apiBase/api/health" -Headers @($acceptJson)
Add-LabCheck -Name 'backend /api/health responde 200' -Passed ($health.Status -eq 200) -Detail "status=$($health.Status)"
Add-LabCheck -Name 'backend /api/health devuelve status=ok' -Passed ($health.Body -match '"status"\s*:\s*"ok"') -Detail 'body contiene status=ok'

# -- 2. Marca de instancia: APP_VERSION=lab-local ----------------------------
$sysHealth = Invoke-LabCurlRequest -Name '02-backend-system-health' -Method 'GET' -Url "$apiBase/api/system/health" -Headers @($acceptJson)
Add-LabCheck -Name 'backend /api/system/health responde 200' -Passed ($sysHealth.Status -eq 200) -Detail "status=$($sysHealth.Status)"
Add-LabCheck -Name 'backend reporta version=lab-local (entorno .env.local)' -Passed ($sysHealth.Body -match 'lab-local') -Detail 'marca APP_VERSION=lab-local'

# -- 3. CSRF cookie ----------------------------------------------------------
$csrf = Invoke-LabCurlRequest -Name '03-sanctum-csrf-cookie' -Method 'GET' -Url "$webBase/sanctum/csrf-cookie" -Headers @($acceptJson) -CookieJarPath $cookieJar -UseCookieJar
Add-LabCheck -Name 'frontend proxy /sanctum/csrf-cookie responde' -Passed ($csrf.Status -eq 204 -or $csrf.Status -eq 200) -Detail "status=$($csrf.Status)"

$xsrfToken = ''
if (Test-Path -LiteralPath $cookieJar) {
    foreach ($line in (Get-Content -LiteralPath $cookieJar)) {
        if ($line -match '^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(\S.*)$' -and $line -match 'XSRF-TOKEN') {
            $xsrfToken = [System.Uri]::UnescapeDataString(($line -split "`t")[-1])
        }
    }
}
Add-LabCheck -Name 'cookie XSRF-TOKEN emitida' -Passed (-not [string]::IsNullOrWhiteSpace($xsrfToken)) -Detail 'token CSRF capturado (no se imprime)'

# -- 4. Login con usuario sintetico -----------------------------------------
# OJO: PowerShell no distingue mayusculas en nombres de variables, por eso el
# resultado se guarda en $loginResponse y no en $login (que pisaria al
# parametro -Login).
$loginBody = '{' + '"login":"' + $Login + '","password":"' + $Password + '"}'
$loginResponse = Invoke-LabCurlRequest -Name '04-auth-login' -Method 'POST' -Url "$webBase/api/auth/login" `
    -Headers @($acceptJson, ('X-XSRF-TOKEN: ' + $xsrfToken), "Origin: $webBase", "Referer: $webBase/") `
    -JsonBody $loginBody -CookieJarPath $cookieJar -UseCookieJar
Add-LabCheck -Name "login ($Login) responde 200" -Passed ($loginResponse.Status -eq 200) -Detail "status=$($loginResponse.Status)"
Add-LabCheck -Name 'login devuelve el usuario sintetico' -Passed ($loginResponse.Body -match [regex]::Escape($Login)) -Detail 'respuesta no contiene la contrasena'

# -- 5. Sesion autenticada ---------------------------------------------------
$me = Invoke-LabCurlRequest -Name '05-auth-me' -Method 'GET' -Url "$webBase/api/auth/me" -Headers @($acceptJson) -CookieJarPath $cookieJar
Add-LabCheck -Name 'GET /api/auth/me con sesion responde 200' -Passed ($me.Status -eq 200) -Detail "status=$($me.Status)"

# -- 6. Endpoint autenticado con datos del catalogo --------------------------
$services = Invoke-LabCurlRequest -Name '06-services-index' -Method 'GET' -Url "$webBase/api/services" -Headers @($acceptJson) -CookieJarPath $cookieJar
Add-LabCheck -Name 'GET /api/services (autenticado) responde 200' -Passed ($services.Status -eq 200) -Detail "status=$($services.Status); bytes=$($services.Body.Length)"

# -- 7-8. Frontend servido y cliente Vite ------------------------------------
$index = Invoke-LabCurlRequest -Name '07-frontend-index' -Method 'GET' -Url "$webBase/"
Add-LabCheck -Name 'frontend / responde 200' -Passed ($index.Status -eq 200) -Detail "status=$($index.Status)"
Add-LabCheck -Name 'frontend sirve el HTML de la app' -Passed ($index.Body -match 'id="root"') -Detail 'contiene #root'

$viteClient = Invoke-LabCurlRequest -Name '08-vite-client' -Method 'GET' -Url "$webBase/@vite/client"
Add-LabCheck -Name 'frontend sirve /@vite/client' -Passed ($viteClient.Status -eq 200) -Detail "status=$($viteClient.Status)"

# -- 9-10. Proxy del frontend hacia ESTE backend -----------------------------
$proxyHealth = Invoke-LabCurlRequest -Name '09-proxy-health' -Method 'GET' -Url "$webBase/api/health" -Headers @($acceptJson)
Add-LabCheck -Name 'proxy /api/health responde 200' -Passed ($proxyHealth.Status -eq 200) -Detail "status=$($proxyHealth.Status)"

$proxyVersion = Invoke-LabCurlRequest -Name '10-proxy-system-health' -Method 'GET' -Url "$webBase/api/system/health" -Headers @($acceptJson)
Add-LabCheck -Name 'proxy llega a ESTE backend (version lab-local)' -Passed ($proxyVersion.Body -match 'lab-local') -Detail 'version=lab-local via proxy'

# -- 11. Control negativo ----------------------------------------------------
$anon = Invoke-LabCurlRequest -Name '11-anonymous-me' -Method 'GET' -Url "$apiBase/api/auth/me" -Headers @($acceptJson)
Add-LabCheck -Name 'control negativo: /api/auth/me sin sesion da 401' -Passed ($anon.Status -eq 401) -Detail "status=$($anon.Status)"

# ---------------------------------------------------------------------------
# Evidencia
# ---------------------------------------------------------------------------
$passedCount = @($checks | Where-Object { $_.passed }).Count
$totalCount = $checks.Count
$failed = @($checks | Where-Object { -not $_.passed })

$result = [pscustomobject]@{
    task_id          = 'C1-INST-02'
    run_id           = $runId
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    lab              = 'local no-docker (backend artisan serve + vite + MariaDB XAMPP)'
    docker_parity    = $false
    backend_url      = $apiBase
    frontend_url     = $webBase
    database         = $(if ($null -ne $state) { [string] $state.database } else { 'sh_ai_lab_local' })
    login_user       = $Login
    password_note    = 'contrasena del seeder sintetico; no impresa ni persistida'
    checks_passed    = $passedCount
    checks_total     = $totalCount
    checks           = $checks
}

$result | ConvertTo-Json -Depth 6 | ForEach-Object { Set-LabLocalFileText -Path (Join-Path $runRoot 'smoke-result.json') -Content $_ }

$md = New-Object System.Collections.ArrayList
[void] $md.Add('# C1-INST-02 - Smoke del laboratorio local NO-Docker')
[void] $md.Add('')
[void] $md.Add("- run_id: ``$runId``")
[void] $md.Add("- backend: $apiBase")
[void] $md.Add("- frontend: $webBase")
[void] $md.Add("- base: $(if ($null -ne $state) { [string] $state.database } else { 'sh_ai_lab_local' }) (desechable)")
[void] $md.Add("- usuario sintetico: ``$Login`` (contrasena no impresa)")
[void] $md.Add("- resultado: **$passedCount/$totalCount** checks OK")
[void] $md.Add('')
[void] $md.Add('| check | resultado | detalle |')
[void] $md.Add('| --- | --- | --- |')
foreach ($check in $checks) {
    $mark = 'FALLO'
    if ($check.passed) { $mark = 'OK' }
    [void] $md.Add("| $($check.check) | $mark | $($check.detail) |")
}
[void] $md.Add('')
[void] $md.Add('Las respuestas crudas estan en `responses/` (cuerpos reales, sin secretos).')
$md -join [Environment]::NewLine | ForEach-Object { Set-LabLocalFileText -Path (Join-Path $runRoot 'smoke-report.md') -Content $_ }

# La cookie jar contiene cookies de sesion (desechables) y el token CSRF. No se
# conserva en la evidencia: ya cumplio su funcion durante la corrida.
if (Test-Path -LiteralPath $cookieJar) {
    Remove-Item -LiteralPath $cookieJar -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host "Resultado: $passedCount/$totalCount checks OK" -ForegroundColor $(if ($failed.Count -eq 0) { 'Green' } else { 'Red' })
Write-Host "Evidencia: $runRoot"

if ($failed.Count -gt 0) {
    exit 1
}

exit 0
