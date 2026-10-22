#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$installer = Join-Path $PSScriptRoot 'install_native_runtime.ps1'
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw "Missing native installer: $installer"
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-native-install-' + [guid]::NewGuid().ToString('N'))
$payload = Join-Path $tempRoot 'payload'
$installRoot = Join-Path $tempRoot 'program-files'
$dataRoot = Join-Path $tempRoot 'program-data'
try {
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    $manifestModule = Join-Path $PSScriptRoot 'lib\native_manifest.ps1'
    . $manifestModule
    foreach ($relative in $script:NativeRequiredPayloadFiles) {
        $path = Join-Path $payload $relative
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        Set-Content -LiteralPath $path -Value $relative -Encoding ASCII
    }
    [ordered]@{version='2026.09.28';database_update_policy='no_schema_change'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payload 'native-release.json') -Encoding UTF8
    New-NativePayloadManifest -PayloadRoot $payload -Version '2026.09.28' | Out-Null

    $json = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer `
        -PayloadRoot $payload -InstallRoot $installRoot -DataRoot $dataRoot -WhatIfOnly -Json
    if ($LASTEXITCODE -ne 0) { throw "WhatIf installer failed with exit code $LASTEXITCODE" }
    $plan = $json | ConvertFrom-Json

    if ($plan.Network.AppUrl -ne 'http://127.0.0.1:8000') { throw 'WhatIf plan has an unsafe app URL.' }
    if ($plan.Authentication.AutomaticLogin -ne $false) { throw 'WhatIf plan bypasses application login.' }
    if (Test-Path -LiteralPath $installRoot) { throw 'WhatIf installer mutated Program Files root.' }
    if (Test-Path -LiteralPath $dataRoot) { throw 'WhatIf installer mutated ProgramData root.' }
    if (@($plan.Steps) -contains 'verify-pre-migration-backup') { throw 'Fresh install must not claim a pre-existing backup.' }

    Write-Host '[ OK ] Native installer WhatIf contract passed.'
}
finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
