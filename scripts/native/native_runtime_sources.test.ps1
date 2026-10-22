#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$sourcePath = Join-Path $projectRoot 'installer\native\runtime-sources.json'
$fetchScript = Join-Path $PSScriptRoot 'fetch_native_runtimes.ps1'
if (-not (Test-Path -LiteralPath $fetchScript -PathType Leaf)) { throw "Missing runtime fetcher: $fetchScript" }
$manifest = Get-Content -LiteralPath $sourcePath -Raw | ConvertFrom-Json
if ($manifest.architecture -ne 'x64') { throw 'Only the certified x64 architecture is allowed.' }
if (@($manifest.artifacts).Count -ne 5) { throw 'Expected five bundled native runtime artifacts.' }
if (@($manifest.artifacts.id | Sort-Object -Unique).Count -ne 5) { throw 'Runtime ids must be unique.' }
if (@($manifest.artifacts.id) -notcontains 'vcredist') { throw 'Microsoft Visual C++ x64 Redistributable must be bundled.' }
foreach ($artifact in $manifest.artifacts) {
    if ($artifact.url -notmatch '^https://') { throw "Runtime $($artifact.id) does not use HTTPS." }
    if ($artifact.url -match '/latest(?:/|$)') { throw "Runtime $($artifact.id) is not version-pinned." }
    $expectedLength = if ($artifact.algorithm -eq 'SHA512') { 128 } elseif ($artifact.algorithm -eq 'SHA256') { 64 } else { throw 'Unsupported hash algorithm.' }
    if ($artifact.hash -notmatch "^[0-9a-f]{$expectedLength}$") { throw "Runtime $($artifact.id) hash is malformed." }
    if ([string]::IsNullOrWhiteSpace($artifact.checksum_source)) { throw "Runtime $($artifact.id) lacks checksum provenance." }
}

$temp = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-runtime-plan-' + [guid]::NewGuid().ToString('N'))
try {
    $json = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $fetchScript -CacheRoot $temp -WhatIfOnly -Json
    if ($LASTEXITCODE -ne 0) { throw 'Runtime fetch WhatIf failed.' }
    $plan = @((($json -join "`n") | ConvertFrom-Json))
    if ($plan.Count -ne 5) { throw 'Runtime fetch plan is incomplete.' }
    if (Test-Path -LiteralPath $temp) { throw 'Runtime fetch WhatIf mutated the cache.' }
    Write-Host '[ OK ] Native runtime sources contract passed.'
}
finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
