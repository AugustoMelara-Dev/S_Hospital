#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
. (Join-Path $PSScriptRoot 'lib\native_layout.ps1')

$root = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-release-id-' + [guid]::NewGuid().ToString('N'))
try {
    $payload = Join-Path $root 'payload'
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $payload 'application.txt') -Value 'first' -Encoding UTF8
    [ordered]@{ version='2026.09.28' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payload 'native-release.json') -Encoding UTF8
    New-NativePayloadManifest -PayloadRoot $payload -Version '2026.09.28' | Out-Null
    $first = Get-NativePayloadIdentity -PayloadRoot $payload

    $manifestPath = Join-Path $payload 'native-payload.manifest.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $manifest.generated_at_utc = '2099-01-01T00:00:00Z'
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    $timestampOnly = Get-NativePayloadIdentity -PayloadRoot $payload
    if ($timestampOnly.ReleaseId -ne $first.ReleaseId) { throw 'Release identity must ignore manifest generation time.' }

    Set-Content -LiteralPath (Join-Path $payload 'application.txt') -Value 'second' -Encoding UTF8
    New-NativePayloadManifest -PayloadRoot $payload -Version '2026.09.28' | Out-Null
    $second = Get-NativePayloadIdentity -PayloadRoot $payload
    if ($second.ReleaseId -eq $first.ReleaseId) { throw 'Changed payload with the same product version must receive a new release identity.' }

    $layout = Get-NativeInstallLayout -InstallRoot (Join-Path $root 'program') -DataRoot (Join-Path $root 'data') -Version $second.Version -ReleaseId $second.ReleaseId
    if ($layout.Version -ne '2026.09.28' -or $layout.ReleaseRoot -notlike ('*\releases\' + $second.ReleaseId)) { throw 'Release path must use content identity while preserving the visible product version.' }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $manifest.files = @($manifest.files) + $manifest.files[0]
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    $duplicateValidation = Test-NativePayloadManifest -PayloadRoot $payload
    if (-not (@($duplicateValidation.Reasons) -match 'duplicate path in manifest')) { throw 'Manifest validation did not reject duplicate paths.' }

    New-NativePayloadManifest -PayloadRoot $payload -Version '2026.09.29' | Out-Null
    $versionValidation = Test-NativePayloadManifest -PayloadRoot $payload
    if (-not (@($versionValidation.Reasons) -contains 'native release version does not match manifest version')) { throw 'Manifest validation did not cross-check release metadata version.' }
    Write-Host '[ OK ] Native content release identity contract passed.'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
