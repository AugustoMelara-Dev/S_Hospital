#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'build_native_payload_incremental.ps1'
$source = Get-Content -LiteralPath $path -Raw
$tokens = $null
$errors = $null
[void][Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
if (@($errors).Count -ne 0) { throw ('Incremental builder has parse errors: ' + (@($errors.Message) -join '; ')) }

foreach ($needle in @(
    'ExpectedBaseManifestSha256',
    'Output root already exists; refusing to overwrite it',
    'Backend replacement is outside the approved production catalog allowlist',
    'Base payload manifest SHA-256 does not match the validated receipt',
    'Incremental payload contains an unapproved new file',
    'must remain below the project artifacts directory',
    'must not replace the base payload',
    'Refusing to create or remove an unrecognized incremental staging path',
    'Test-NativePayloadManifest',
    'Test-NativePayloadManifest -PayloadRoot $BasePayloadRoot -IntegrityOnly',
    'scripts/native/verify_native_host.ps1',
    'scripts/recover_hospital_access.ps1',
    "ValidateSet('no_schema_change')"
)) {
    if (-not $source.Contains($needle)) { throw "Incremental builder contract is missing: $needle" }
}
if ($source -match 'Expand-Archive|Invoke-WebRequest|composer\s+install') { throw 'Incremental builder must not download, extract runtimes or run Composer.' }

. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
$temp = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-incremental-' + [guid]::NewGuid().ToString('N'))
try {
    $project = Join-Path $temp 'project'
    $base = Join-Path $project 'artifacts\base'
    $backend = Join-Path $project 'artifacts\backend'
    $output = Join-Path $project 'artifacts\payload-3'
    foreach ($relative in $script:NativeRequiredPayloadFiles) {
        $target = Join-Path $base $relative
        New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
        Set-Content -LiteralPath $target -Value ("base:" + $relative) -Encoding ASCII
    }
    [ordered]@{ product='S_Hospital'; version='2026.09.28.2'; architecture='x64'; database_update_policy='no_schema_change'; runtime_versions=[ordered]@{php='test';mariadb='test';caddy='test';winsw='test';vcredist='test'} } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $base 'native-release.json') -Encoding UTF8
    New-NativePayloadManifest -PayloadRoot $base -Version '2026.09.28.2' | Out-Null
    $baseManifest = Join-Path $base 'native-payload.manifest.json'
    $baseHash = (Get-FileHash -LiteralPath $baseManifest -Algorithm SHA256).Hash

    foreach ($relative in @($script:NativeRequiredPayloadFiles | Where-Object { $_ -like 'scripts/native/*' })) {
        $target = Join-Path $project $relative
        New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
        Set-Content -LiteralPath $target -Value ("current:" + $relative) -Encoding ASCII
    }
    $accessRecoveryTarget=Join-Path $project 'scripts\recover_hospital_access.ps1'
    New-Item -ItemType Directory -Path (Split-Path $accessRecoveryTarget -Parent) -Force|Out-Null
    Set-Content -LiteralPath $accessRecoveryTarget -Value 'current:scripts/recover_hospital_access.ps1' -Encoding ASCII
    foreach ($relative in @('database\seeders\ServiceCatalogSeeder.php','database\seeders\data\catalogo_servicios_inicial.csv')) {
        $target = Join-Path $backend $relative
        New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
        Set-Content -LiteralPath $target -Value ("approved:" + $relative) -Encoding UTF8
    }

    & $path -ProjectRoot $project -ProductionBackendRoot $backend -BasePayloadRoot $base -ExpectedBaseManifestSha256 $baseHash -OutputRoot $output -Version '2026.09.28.3' -BackendRelativePath @('database\seeders\ServiceCatalogSeeder.php','database\seeders\data\catalogo_servicios_inicial.csv') | Out-Null
    $validation = Test-NativePayloadManifest -PayloadRoot $output
    if (-not $validation.Ready) { throw "Incremental fixture output is invalid: $($validation.Reasons -join '; ')" }
    $baseRelease = Get-Content -LiteralPath (Join-Path $base 'native-release.json') -Raw | ConvertFrom-Json
    $newRelease = Get-Content -LiteralPath (Join-Path $output 'native-release.json') -Raw | ConvertFrom-Json
    if ($baseRelease.version -ne '2026.09.28.2') { throw 'Incremental build modified the base payload.' }
    if ($newRelease.version -ne '2026.09.28.3') { throw 'Incremental output version is wrong.' }
    if ((Get-Content -LiteralPath (Join-Path $output 'app\backend\database\seeders\data\catalogo_servicios_inicial.csv') -Raw) -notmatch '^approved:') { throw 'Approved catalog replacement was not published.' }
}
finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}

Write-Output 'PASS incremental native builder contract and fixture (validated base receipt, explicit replacements, one full output validation).'
