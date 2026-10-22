#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$installer = Join-Path $PSScriptRoot 'install_native_runtime.ps1'
$manifestModule = Join-Path $PSScriptRoot 'lib\native_manifest.ps1'
. $manifestModule

$root = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-native-sandbox-' + [guid]::NewGuid().ToString('N'))
$payload = Join-Path $root 'payload'
$installRoot = Join-Path $root 'program'
$dataRoot = Join-Path $root 'data'
try {
    foreach ($relative in $script:NativeRequiredPayloadFiles) {
        $path = Join-Path $payload $relative
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        Set-Content -LiteralPath $path -Value $relative -Encoding ASCII
    }
    [ordered]@{version='2026.09.28';database_update_policy='no_schema_change'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payload 'native-release.json') -Encoding UTF8
    New-NativePayloadManifest -PayloadRoot $payload -Version '2026.09.28' | Out-Null

    # The same payload must resolve to the same immutable release identity in
    # the PowerShell 7 test host and the Windows PowerShell 5.1 installer.
    $identity = Get-NativePayloadIdentity -PayloadRoot $payload

    $json = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer `
        -PayloadRoot $payload -InstallRoot $installRoot -DataRoot $dataRoot -SandboxOnly -Json
    if ($LASTEXITCODE -ne 0) { throw "Sandbox install failed with exit code $LASTEXITCODE." }
    $result = $json | ConvertFrom-Json
    if (-not $result.Ready) { throw 'Sandbox install did not report readiness.' }
    if ($result.ServicesInstalled -ne $false) { throw 'Sandbox install must not register services.' }
    if ($result.StartupInstalled -ne $false) { throw 'Sandbox install must not modify Startup.' }
    if (($json -join "`n") -match 'APP_KEY|DB_PASSWORD|BACKUP_ENCRYPTION') { throw 'Install result exposed secrets.' }

    $release = Join-Path $installRoot ('releases\' + $identity.ReleaseId)
    if (-not (Test-Path -LiteralPath (Join-Path $release 'app\backend\artisan'))) { throw "Versioned release was not staged. Expected '$release'; installer reported '$($result.ReleaseRoot)'." }
    if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'current\app\backend\artisan'))) { throw 'Current release pointer was not created.' }
    $envPath = Join-Path $dataRoot 'config\hospital.env'
    if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) { throw 'Runtime environment was not created.' }
    $firstHash = (Get-FileHash -LiteralPath $envPath -Algorithm SHA256).Hash

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer `
        -PayloadRoot $payload -InstallRoot $installRoot -DataRoot $dataRoot -SandboxOnly | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Sandbox reinstall failed.' }
    $secondHash = (Get-FileHash -LiteralPath $envPath -Algorithm SHA256).Hash
    if ($firstHash -ne $secondHash) { throw 'Reinstall rotated persisted secrets.' }

    Write-Host '[ OK ] Native sandbox installation contract passed.'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
