#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$updater = Join-Path $PSScriptRoot 'update_native_runtime.ps1'
if (-not (Test-Path -LiteralPath $updater -PathType Leaf)) { throw "Missing native updater: $updater" }
. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
$root = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-update-' + [guid]::NewGuid().ToString('N'))
try {
    $payload = Join-Path $root 'payload'
    foreach ($relative in $script:NativeRequiredPayloadFiles) {
        $path = Join-Path $payload $relative
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        Set-Content -LiteralPath $path -Value $relative -Encoding ASCII
    }
    [ordered]@{ version='2026.09.29'; database_update_policy='no_schema_change'; runtime_versions=[ordered]@{mariadb='11.4.5'} } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $payload 'native-release.json') -Encoding UTF8
    New-NativePayloadManifest -PayloadRoot $payload -Version '2026.09.29' | Out-Null
    $install = Join-Path $root 'program'
    $data = Join-Path $root 'data'
    New-Item -ItemType Directory -Path (Join-Path $data 'database\mysql') -Force | Out-Null
    $json = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $updater -PayloadRoot $payload -InstallRoot $install -DataRoot $data -WhatIfOnly -Json
    if ($LASTEXITCODE -ne 0) { throw 'Native update WhatIf failed.' }
    $plan = ($json -join "`n") | ConvertFrom-Json
    $steps = @($plan.Steps)
    if ([Array]::IndexOf($steps, 'verify-definitive-offline-backup') -gt [Array]::IndexOf($steps, 'run-migrations')) { throw 'Update backup must precede migration.' }
    if ([Array]::IndexOf($steps, 'stop-application-writers') -gt [Array]::IndexOf($steps, 'verify-definitive-offline-backup')) { throw 'Definitive backup must run only after writers stop.' }
    if ($steps -match 'seed') { throw 'Updates must not seed catalog or fixture data.' }
    if ($plan.Rollback.CodeRelease -ne 'previous-junction') { throw 'Update plan lacks code rollback.' }
    $source = Get-Content -LiteralPath $updater -Raw
    $policySource = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lib\native_update_policy.ps1') -Raw
    if ($source -match "Invoke-WebRequest -Uri 'http://127\.0\.0\.1:8000") { throw 'Updater must read persisted APP_URL.' }
    if ($source -notmatch 'Wait-NativeServiceStatus') { throw 'Updater must wait for service stop/start state.' }
    if ($source -notmatch 'current\.previous-') { throw 'Updater must recover an interrupted current-pointer switch.' }
    if ($source -notmatch '\.candidate-update-' -or $source -notmatch 'Assert-NativeUpdateReleaseMutationPath') { throw 'Updater must stage and validate temporary releases below the immutable releases root.' }
    if ($source -notmatch 'Get-NativePayloadIdentity' -or $source -notmatch 'ReleaseId') { throw 'Updater must distinguish rebuilt payloads that share a product version.' }
    if ($source -notmatch 'Downgrade.+blocked' -or $policySource -notmatch 'modifies an installed migration') { throw 'Updater must reject downgrades and mutated installed migrations.' }
    if ($source -notmatch 'Test-NativeDatabaseUpdateCompatibility' -or $policySource -notmatch 'backward_compatible_additive' -or $source -notmatch 'Definitive offline pre-migration backup') { throw 'Updater must require an explicit additive policy and create its definitive backup after writers stop.' }
    if ($source -match 'Write-NativePhpConfiguration') { throw 'Updater must not mutate active PHP configuration before payload validation and backup.' }
    if ($source -notmatch 'Invoke-NativeUpdateActivation') { throw 'Updater must use the shared activation and rollback engine.' }
    if ($source -notmatch 'DatabasePreserved' -or $source -notmatch 'ConfigurationPreserved') { throw 'Update result must report persistent state preservation.' }
    if ($source -match "Phase 'switching'") { throw 'Updater must not journal a rollback pointer before it exists.' }
    if ($source.IndexOf("Phase 'completed'") -gt $source.IndexOf('Remove-Item -LiteralPath $previousPointer')) { throw 'Updater must commit durable completion before deleting its rollback pointer.' }
    if ($source -notmatch "Phase 'recovering'[\s\S]+PreviousTarget") { throw 'Updater recovery must journal the previous target before moving it.' }
    Write-Host '[ OK ] Native update WhatIf contract passed.'
}
finally { if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force } }
