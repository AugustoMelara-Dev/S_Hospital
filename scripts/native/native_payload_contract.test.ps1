#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$modulePath = Join-Path $PSScriptRoot 'lib\native_manifest.ps1'
if (-not (Test-Path -LiteralPath $modulePath -PathType Leaf)) {
    throw "Missing native manifest module: $modulePath"
}
. $modulePath

$script:Checks = 0
function Assert-PayloadContract {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) { throw $Message }
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-native-payload-' + [guid]::NewGuid().ToString('N'))
$legacyRoot = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-native-legacy-' + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $tempRoot 'runtime\php') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempRoot 'runtime\mariadb\bin') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempRoot 'runtime\caddy') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempRoot 'runtime\winsw') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $tempRoot 'app\backend\public') -Force | Out-Null
    foreach ($relative in $script:NativeRequiredPayloadFiles) {
        $path = Join-Path $tempRoot $relative
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        Set-Content -LiteralPath $path -Value $relative -Encoding ASCII
    }
    [ordered]@{version='2026.09.28';database_update_policy='no_schema_change'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $tempRoot 'native-release.json') -Encoding UTF8

    $manifestPath = New-NativePayloadManifest -PayloadRoot $tempRoot -Version '2026.09.28'
    Assert-PayloadContract (Test-Path -LiteralPath $manifestPath -PathType Leaf) 'Manifest was not created.'

    $valid = Test-NativePayloadManifest -PayloadRoot $tempRoot
    Assert-PayloadContract $valid.Ready 'Fresh payload must validate.'
    Assert-PayloadContract ($valid.FilesChecked -eq $script:NativeRequiredPayloadFiles.Count) 'Every payload file except the manifest must be checked.'

    Add-Content -LiteralPath (Join-Path $tempRoot 'app\backend\artisan') -Value 'tampered'
    $tampered = Test-NativePayloadManifest -PayloadRoot $tempRoot
    Assert-PayloadContract (-not $tampered.Ready) 'Tampered payload must be rejected.'
    Assert-PayloadContract (($tampered.Reasons -join ' ') -match 'hash') 'Tamper reason must identify a hash mismatch.'

    Remove-Item -LiteralPath (Join-Path $tempRoot 'runtime\caddy\caddy.exe') -Force
    $missing = Test-NativePayloadManifest -PayloadRoot $tempRoot
    Assert-PayloadContract (-not $missing.Ready) 'Missing runtime file must be rejected.'
    Assert-PayloadContract (($missing.Reasons -join ' ') -match 'missing') 'Missing file reason must be explicit.'

    $legacyOmissions = @('scripts/native/diagnose_native_partial.ps1','scripts/native/lib/native_initial_repair.ps1')
    foreach ($relative in @($script:NativeRequiredPayloadFiles | Where-Object { $_ -notin $legacyOmissions })) {
        $path = Join-Path $legacyRoot $relative
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        Set-Content -LiteralPath $path -Value $relative -Encoding ASCII
    }
    [ordered]@{version='2026.09.28.3';database_update_policy='no_schema_change'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $legacyRoot 'native-release.json') -Encoding UTF8
    New-NativePayloadManifest -PayloadRoot $legacyRoot -Version '2026.09.28.3' | Out-Null
    $legacyStrict = Test-NativePayloadManifest -PayloadRoot $legacyRoot
    Assert-PayloadContract (-not $legacyStrict.Ready) 'A historical release must not satisfy current candidate file requirements.'
    Assert-PayloadContract (($legacyStrict.Reasons -join ' ') -match 'diagnose_native_partial') 'Strict validation must identify the missing current candidate requirement.'
    $legacyIntegrity = Test-NativePayloadManifest -PayloadRoot $legacyRoot -IntegrityOnly
    Assert-PayloadContract $legacyIntegrity.Ready 'Historical integrity validation must accept an intact older manifest without current-only files.'
    Add-Content -LiteralPath (Join-Path $legacyRoot 'app\backend\artisan') -Value 'tampered'
    $legacyTampered = Test-NativePayloadManifest -PayloadRoot $legacyRoot -IntegrityOnly
    Assert-PayloadContract (-not $legacyTampered.Ready) 'Historical integrity validation must still reject byte tampering.'
    Assert-PayloadContract (($legacyTampered.Reasons -join ' ') -match 'hash mismatch') 'Historical tamper reason must remain explicit.'
    Remove-Item -LiteralPath (Join-Path $legacyRoot 'native-runtime-probe.json') -Force
    New-NativePayloadManifest -PayloadRoot $legacyRoot -Version '2026.09.28.3' | Out-Null
    $legacyWithoutMetadata = Test-NativePayloadManifest -PayloadRoot $legacyRoot -IntegrityOnly
    Assert-PayloadContract (-not $legacyWithoutMetadata.Ready) 'Historical integrity validation must retain minimum release metadata requirements.'
    Assert-PayloadContract (($legacyWithoutMetadata.Reasons -join ' ') -match 'historical integrity metadata missing.*native-runtime-probe') 'Missing historical metadata reason must be explicit.'

    Write-Host "[ OK ] Native payload contract passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
    if (Test-Path -LiteralPath $legacyRoot) { Remove-Item -LiteralPath $legacyRoot -Recurse -Force }
}
