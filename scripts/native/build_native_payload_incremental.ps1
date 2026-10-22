#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $ProjectRoot,
    [Parameter(Mandatory = $true)][string] $ProductionBackendRoot,
    [Parameter(Mandatory = $true)][string] $BasePayloadRoot,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string] $ExpectedBaseManifestSha256,
    [Parameter(Mandatory = $true)][string] $OutputRoot,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9A-Za-z][0-9A-Za-z._-]+$')][string] $Version,
    [Parameter(Mandatory = $true)][string[]] $BackendRelativePath,
    [ValidateSet('no_schema_change')][string] $DatabaseUpdatePolicy = 'no_schema_change'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')

function Get-IncrementalRelativePath {
    param([string] $Root, [string] $Path)
    $rootUri = [Uri](([IO.Path]::GetFullPath($Root)).TrimEnd('\') + '\')
    $pathUri = [Uri]([IO.Path]::GetFullPath($Path))
    [Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString()).Replace('\', '/')
}

function Assert-BackendReplacementPath {
    param([string] $RelativePath)
    $normalized = $RelativePath.Replace('/', '\').TrimStart('\')
    if ($normalized -eq '' -or [IO.Path]::IsPathRooted($normalized) -or $normalized -match '(^|\\)\.\.(\\|$)') {
        throw "Unsafe backend replacement path: $RelativePath"
    }
    $allowed = @(
        'database\seeders\ServiceCatalogSeeder.php',
        'database\seeders\data\catalogo_servicios_inicial.csv',
        'database\seeders\ProductionInstallationSeeder.php'
    )
    if ($allowed -notcontains $normalized) { throw "Backend replacement is outside the approved production catalog allowlist: $RelativePath" }
    return $normalized
}

function Test-IncrementalPathBelowRoot {
    param([string] $Path, [string] $Root)
    $fullPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $fullRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    $fullPath.StartsWith($fullRoot + '\', [StringComparison]::OrdinalIgnoreCase)
}

function Assert-IncrementalTemporaryPath {
    param([string] $TemporaryPath, [string] $ExpectedOutputRoot, [string] $ArtifactsRoot)
    $temporaryFull = [IO.Path]::GetFullPath($TemporaryPath).TrimEnd('\')
    $outputFull = [IO.Path]::GetFullPath($ExpectedOutputRoot).TrimEnd('\')
    $artifactsFull = [IO.Path]::GetFullPath($ArtifactsRoot).TrimEnd('\')
    $expectedPrefix = $outputFull + '.staging-'
    $suffix = $temporaryFull.Substring([Math]::Min($temporaryFull.Length, $expectedPrefix.Length))
    if (-not $temporaryFull.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        $suffix -notmatch '^[0-9a-f]{32}$' -or
        -not (Test-IncrementalPathBelowRoot -Path $temporaryFull -Root $artifactsFull)) {
        throw 'Refusing to create or remove an unrecognized incremental staging path.'
    }
    return $temporaryFull
}

function Write-IncrementalManifest {
    param(
        [string] $PayloadRoot,
        [string] $BaseManifestPath,
        [string] $PayloadVersion,
        [Collections.Generic.HashSet[string]] $ChangedPaths
    )
    $baseManifest = Get-Content -LiteralPath $BaseManifestPath -Raw | ConvertFrom-Json
    $baseEntries = @{}
    foreach ($entry in @($baseManifest.files)) {
        $key = ([string]$entry.path).ToLowerInvariant()
        if ($baseEntries.ContainsKey($key)) { throw "Base manifest contains duplicate path: $($entry.path)" }
        $baseEntries[$key] = $entry
    }

    $entries = New-Object Collections.Generic.List[object]
    foreach ($file in @(Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File | Where-Object Name -ne 'native-payload.manifest.json' | Sort-Object FullName)) {
        $relative = Get-IncrementalRelativePath -Root $PayloadRoot -Path $file.FullName
        $key = $relative.ToLowerInvariant()
        if ($ChangedPaths.Contains($key)) {
            $entries.Add([ordered]@{ path = $relative; bytes = [int64]$file.Length; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() })
        }
        elseif ($baseEntries.ContainsKey($key)) {
            $base = $baseEntries[$key]
            $entries.Add([ordered]@{ path = [string]$base.path; bytes = [int64]$base.bytes; sha256 = ([string]$base.sha256).ToLowerInvariant() })
        }
        else {
            throw "Incremental payload contains an unapproved new file: $relative"
        }
    }

    $actualKeys = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $entries) { [void]$actualKeys.Add([string]$entry.path) }
    foreach ($baseKey in $baseEntries.Keys) {
        if (-not $actualKeys.Contains($baseKey)) { throw "Incremental payload unexpectedly removed a base file: $($baseEntries[$baseKey].path)" }
    }
    foreach ($changed in $ChangedPaths) {
        if (-not $actualKeys.Contains($changed)) { throw "Approved replacement was not present in the payload: $changed" }
    }

    $manifest = [ordered]@{
        schema_version = 1
        product = 'S_Hospital'
        version = $PayloadVersion
        architecture = 'x64'
        generated_at_utc = [DateTime]::UtcNow.ToString('o')
        files = $entries.ToArray()
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PayloadRoot 'native-payload.manifest.json') -Encoding UTF8
}

foreach ($directory in @($ProjectRoot,$ProductionBackendRoot,$BasePayloadRoot)) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) { throw "Required directory is missing: $directory" }
}
$projectFull = (Resolve-Path -LiteralPath $ProjectRoot).Path.TrimEnd('\')
$artifactsRoot = Join-Path $projectFull 'artifacts'
if (-not (Test-Path -LiteralPath $artifactsRoot -PathType Container)) { throw 'Project artifacts directory is missing.' }
$artifactsItem = Get-Item -LiteralPath $artifactsRoot -Force
if (($artifactsItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Project artifacts directory must not be a reparse point.' }
$artifactsRoot = $artifactsItem.FullName.TrimEnd('\')
$productionFull = (Resolve-Path -LiteralPath $ProductionBackendRoot).Path.TrimEnd('\')
$baseFull = (Resolve-Path -LiteralPath $BasePayloadRoot).Path.TrimEnd('\')
$outputFull = [IO.Path]::GetFullPath($OutputRoot).TrimEnd('\')
$outputParent = Split-Path -Parent $outputFull
if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) { throw 'Incremental output parent directory is missing.' }
$outputParentResolved = (Resolve-Path -LiteralPath $outputParent).Path.TrimEnd('\')
if (-not (Test-IncrementalPathBelowRoot -Path $productionFull -Root $artifactsRoot) -or
    -not (Test-IncrementalPathBelowRoot -Path $baseFull -Root $artifactsRoot) -or
    -not ($outputParentResolved.Equals($artifactsRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-IncrementalPathBelowRoot -Path $outputParentResolved -Root $artifactsRoot)) -or
    -not (Test-IncrementalPathBelowRoot -Path $OutputRoot -Root $artifactsRoot)) {
    throw 'Incremental staging, base and output roots must remain below the project artifacts directory.'
}
if ($baseFull.Equals($outputFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Incremental output must not replace the base payload.'
}
if (Test-Path -LiteralPath $OutputRoot) { throw "Output root already exists; refusing to overwrite it: $OutputRoot" }
$baseManifestPath = Join-Path $BasePayloadRoot 'native-payload.manifest.json'
if (-not (Test-Path -LiteralPath $baseManifestPath -PathType Leaf)) { throw 'Base payload manifest is missing.' }
$baseManifestHash = (Get-FileHash -LiteralPath $baseManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($baseManifestHash -ne $ExpectedBaseManifestSha256.ToLowerInvariant()) { throw 'Base payload manifest SHA-256 does not match the validated receipt.' }
$baseValidation=Test-NativePayloadManifest -PayloadRoot $BasePayloadRoot -IntegrityOnly
if(-not$baseValidation.Ready){throw "Base payload byte integrity failed: $($baseValidation.Reasons -join '; ')"}

$stage = Assert-IncrementalTemporaryPath -TemporaryPath ($outputFull + '.staging-' + [guid]::NewGuid().ToString('N')) -ExpectedOutputRoot $outputFull -ArtifactsRoot $artifactsRoot
$changed = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
try {
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    Get-ChildItem -LiteralPath $BasePayloadRoot -Force | Copy-Item -Destination $stage -Recurse -Force

    foreach ($relativeInput in $BackendRelativePath) {
        $relative = Assert-BackendReplacementPath $relativeInput
        $source = Join-Path $ProductionBackendRoot $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Approved backend replacement is missing: $source" }
        $payloadRelative = ('app\backend\' + $relative)
        $destination = Join-Path $stage $payloadRelative
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
        [void]$changed.Add($payloadRelative.Replace('\','/').ToLowerInvariant())
    }

    $nativeSource = Join-Path $ProjectRoot 'scripts\native'
    $nativeDestination = Join-Path $stage 'scripts\native'
    $runtimeScripts = @('diagnose_native_partial.ps1','install_native_runtime.ps1','invoke_native_artisan.ps1','recovery_wizard.ps1','restore_native.ps1','run_native_service.ps1','start_native_app.ps1','update_native_runtime.ps1','verify_native_host.ps1')
    foreach ($name in $runtimeScripts) {
        $source = Join-Path $nativeSource $name
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Required native runtime script is missing: $name" }
        $destination = Join-Path $nativeDestination $name
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
        [void]$changed.Add(('scripts/native/' + $name).ToLowerInvariant())
    }
    $accessRecoverySource=Join-Path $ProjectRoot 'scripts\recover_hospital_access.ps1'
    $accessRecoveryDestination=Join-Path $stage 'scripts\recover_hospital_access.ps1'
    if(-not(Test-Path -LiteralPath $accessRecoverySource -PathType Leaf)){throw 'Required native access-recovery script is missing.'}
    Copy-Item -LiteralPath $accessRecoverySource -Destination $accessRecoveryDestination -Force
    [void]$changed.Add('scripts/recover_hospital_access.ps1')
    foreach ($source in @(Get-ChildItem -LiteralPath (Join-Path $nativeSource 'lib') -File)) {
        $destination = Join-Path $nativeDestination ('lib\' + $source.Name)
        New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $source.FullName -Destination $destination -Force
        [void]$changed.Add(('scripts/native/lib/' + $source.Name).ToLowerInvariant())
    }

    $releasePath = Join-Path $stage 'native-release.json'
    $release = Get-Content -LiteralPath $releasePath -Raw | ConvertFrom-Json
    $release.version = $Version
    $release.database_update_policy = $DatabaseUpdatePolicy
    $release | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $releasePath -Encoding UTF8
    [void]$changed.Add('native-release.json')

    # The verifier is new relative to 2026.09.28.2 and is intentionally allowed.
    [void]$changed.Add('scripts/native/verify_native_host.ps1')
    Write-IncrementalManifest -PayloadRoot $stage -BaseManifestPath $baseManifestPath -PayloadVersion $Version -ChangedPaths $changed
    $validation = Test-NativePayloadManifest -PayloadRoot $stage
    if (-not $validation.Ready) { throw "Incremental payload did not pass full validation: $($validation.Reasons -join '; ')" }
    Move-Item -LiteralPath $stage -Destination $OutputRoot
    $identity = Get-NativePayloadIdentity -PayloadRoot $OutputRoot
    [pscustomobject]@{
        Ready = $true
        Mode = 'incremental-from-validated-payload'
        Version = $Version
        ReleaseId = $identity.ReleaseId
        ContentSha256 = $identity.ContentSha256
        BaseManifestSha256 = $baseManifestHash
        BaseFilesChecked = $baseValidation.FilesChecked
        Files = $validation.FilesChecked
        OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
        Replacements = @($changed | Sort-Object)
    }
}
finally {
    $safeStage = Assert-IncrementalTemporaryPath -TemporaryPath $stage -ExpectedOutputRoot $outputFull -ArtifactsRoot $artifactsRoot
    if (Test-Path -LiteralPath $safeStage) { Remove-Item -LiteralPath $safeStage -Recurse -Force }
}
