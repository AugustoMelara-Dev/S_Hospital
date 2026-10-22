#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$launcher = Join-Path $PSScriptRoot 'start_native_app.ps1'
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw "Missing native launcher: $launcher" }
$json = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher -InstallRoot 'C:\Program Files\S_Hospital' -AppUrl 'http://127.0.0.1:8000' -WhatIfOnly -Json
if ($LASTEXITCODE -ne 0) { throw 'Native launcher WhatIf failed.' }
$plan = ($json -join "`n") | ConvertFrom-Json
if ($plan.AppUrl -ne 'http://127.0.0.1:8000') { throw 'Launcher URL is wrong.' }
if ($plan.HealthUrl -ne 'http://127.0.0.1:8000/up') { throw 'Launcher health URL is wrong.' }
$setupJson = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher -InstallRoot 'C:\Program Files\S_Hospital' -AppUrl 'http://127.0.0.1:8000/administracion/ajustes' -WhatIfOnly -Json
$setupPlan = ($setupJson -join "`n") | ConvertFrom-Json
if ($setupPlan.AppUrl -ne 'http://127.0.0.1:8000/administracion/ajustes' -or $setupPlan.HealthUrl -ne 'http://127.0.0.1:8000/up') { throw 'Initial setup launcher must preserve the route and probe the origin health endpoint.' }
if ($plan.AutomaticLogin -ne $false) { throw 'Launcher must preserve login.' }
if ($plan.WaitSeconds -lt 120) { throw 'Launcher must allow Windows delayed-start services to become ready after sign-in.' }
if ($plan.WaitSeconds -gt 300) { throw 'Launcher wait is unreasonably long.' }
if ($plan.RetryWaitSeconds -gt 30) { throw 'Launcher retries must remain short after the initial startup grace period.' }
$source = Get-Content -LiteralPath $launcher -Raw
if ($source -notmatch 'RetryCancel') { throw 'Launcher failure state must offer retry.' }
if ($source -match 'Diagnóstico y reparación') { throw 'Launcher failure copy must not reference missing shortcuts.' }
if ($source -notmatch 'S_Hospital todavía está iniciando') { throw 'Launcher needs plain-language startup copy.' }
Write-Host '[ OK ] Native login launcher contract passed.'
