#Requires -Version 5.1

Set-StrictMode -Version Latest

$script:NativeManifestName = 'native-payload.manifest.json'
$script:NativeHistoricalIntegrityFiles = @(
    'native-release.json',
    'native-runtime-probe.json'
)
$script:NativeRequiredPayloadFiles = @(
    'native-release.json',
    'native-runtime-probe.json',
    'app/backend/artisan',
    'app/backend/public/index.php',
    'app/backend/vendor/autoload.php',
    'app/frontend/dist/index.html',
    'runtime/caddy/caddy.exe',
    'runtime/mariadb/bin/mariadb-install-db.exe',
    'runtime/mariadb/bin/mariadb-dump.exe',
    'runtime/mariadb/bin/mariadb.exe',
    'runtime/mariadb/bin/mariadbd.exe',
    'runtime/php/php-cgi.exe',
    'runtime/php/php.exe',
    'runtime/winsw/WinSW-x64.exe',
    'runtime/vcredist/vc_redist.x64.exe',
    'scripts/recover_hospital_access.ps1',
    'scripts/native/install_native_runtime.ps1',
    'scripts/native/diagnose_native_partial.ps1',
    'scripts/native/invoke_native_artisan.ps1',
    'scripts/native/recovery_wizard.ps1',
    'scripts/native/restore_native.ps1',
    'scripts/native/run_native_service.ps1',
    'scripts/native/start_native_app.ps1',
    'scripts/native/update_native_runtime.ps1',
    'scripts/native/verify_native_host.ps1',
    'scripts/native/lib/native_acl.ps1',
    'scripts/native/lib/native_cache.ps1',
    'scripts/native/lib/native_config.ps1',
    'scripts/native/lib/native_database_bootstrap.ps1',
    'scripts/native/lib/native_dotenv.ps1',
    'scripts/native/lib/native_elevated_php.ps1',
    'scripts/native/lib/native_install_plan.ps1',
    'scripts/native/lib/native_initial_repair.ps1',
    'scripts/native/lib/native_layout.ps1',
    'scripts/native/lib/native_lock.ps1',
    'scripts/native/lib/native_manifest.ps1',
    'scripts/native/lib/native_prerequisites.ps1',
    'scripts/native/lib/native_secret_store.ps1',
    'scripts/native/lib/native_update_engine.ps1',
    'scripts/native/lib/native_update_policy.ps1'
)

function Get-NativeRelativePath {
    param([string] $Root, [string] $Path)
    $rootUri = [Uri](([IO.Path]::GetFullPath($Root)).TrimEnd('\') + '\')
    $pathUri = [Uri]([IO.Path]::GetFullPath($Path))
    [Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString()).Replace('\', '/')
}

function Get-NativePayloadFiles {
    param([string] $PayloadRoot)
    @(Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File | Where-Object {
        $_.Name -ne $script:NativeManifestName
    } | Sort-Object FullName)
}

function Get-NativePayloadIdentity {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string] $PayloadRoot)

    $manifestPath = Join-Path ([IO.Path]::GetFullPath($PayloadRoot)) $script:NativeManifestName
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Native payload manifest is missing: $manifestPath" }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    # Release identity must be byte-for-byte stable between Windows PowerShell
    # 5.1 (installer) and PowerShell 7 (builder/drills). Sort-Object follows the
    # host culture and produced different release IDs for the same manifest.
    $identityLines = New-Object 'Collections.Generic.List[string]'
    foreach ($entry in @($manifest.files)) {
        $identityLines.Add(([string]$entry.path + "`0" + [string]$entry.bytes + "`0" + ([string]$entry.sha256).ToLowerInvariant() + "`n"))
    }
    $identityLines.Sort([StringComparer]::Ordinal)
    $builder = New-Object Text.StringBuilder
    foreach ($line in $identityLines) { [void]$builder.Append($line) }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($builder.ToString())))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    $version = [string]$manifest.version
    if ($version -notmatch '^[0-9A-Za-z][0-9A-Za-z._-]+$') { throw 'Native payload version is invalid.' }
    [pscustomobject]@{
        Version = $version
        ContentSha256 = $digest
        ReleaseId = $version + '-' + $digest.Substring(0, 12)
    }
}

function New-NativePayloadManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $PayloadRoot,
        [Parameter(Mandatory = $true)][string] $Version
    )

    $root = (Resolve-Path -LiteralPath $PayloadRoot).Path
    $entries = @(Get-NativePayloadFiles -PayloadRoot $root | ForEach-Object {
        [ordered]@{
            path = Get-NativeRelativePath -Root $root -Path $_.FullName
            bytes = [int64]$_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    })
    $manifest = [ordered]@{
        schema_version = 1
        product = 'S_Hospital'
        version = $Version
        architecture = 'x64'
        generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
        files = $entries
    }
    $path = Join-Path $root $script:NativeManifestName
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

function Test-NativePayloadManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $PayloadRoot,
        # Previous immutable releases can predate files introduced by the
        # current installer. Their own manifests remain authoritative for byte
        # integrity; current required-file policy applies to new candidates.
        [switch] $IntegrityOnly
    )

    $reasons = New-Object System.Collections.Generic.List[string]
    $root = [IO.Path]::GetFullPath($PayloadRoot)
    $manifestPath = Join-Path $root $script:NativeManifestName
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        $reasons.Add('manifest missing') | Out-Null
        return [pscustomobject]@{ Ready = $false; FilesChecked = 0; Reasons = @($reasons) }
    }

    try { $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json }
    catch {
        $reasons.Add('manifest invalid JSON') | Out-Null
        return [pscustomobject]@{ Ready = $false; FilesChecked = 0; Reasons = @($reasons) }
    }
    if ($manifest.schema_version -ne 1 -or $manifest.product -ne 'S_Hospital' -or $manifest.architecture -ne 'x64') {
        $reasons.Add('manifest identity is invalid') | Out-Null
    }

    $entries = @($manifest.files)
    $manifestPaths = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $entries) {
        $manifestEntryPath = [string]$entry.path
        if (-not $manifestPaths.Add($manifestEntryPath)) {
            $reasons.Add("duplicate path in manifest: $manifestEntryPath") | Out-Null
        }
    }
    if (-not $IntegrityOnly) {
        foreach ($required in $script:NativeRequiredPayloadFiles) {
            if (-not $manifestPaths.Contains($required)) { $reasons.Add("required file missing from manifest: $required") | Out-Null }
        }
    }
    else {
        foreach ($required in $script:NativeHistoricalIntegrityFiles) {
            if (-not $manifestPaths.Contains($required)) { $reasons.Add("historical integrity metadata missing from manifest: $required") | Out-Null }
        }
    }

    $checked = 0
    foreach ($entry in $entries) {
        $relative = ([string]$entry.path).Replace('/', '\')
        if ([IO.Path]::IsPathRooted($relative) -or $relative -match '(^|\\)\.\.(\\|$)') {
            $reasons.Add("unsafe path in manifest: $($entry.path)") | Out-Null
            continue
        }
        $fullPath = [IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $fullPath.StartsWith($root.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
            $reasons.Add("unsafe path in manifest: $($entry.path)") | Out-Null
            continue
        }
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            $reasons.Add("file missing: $($entry.path)") | Out-Null
            continue
        }
        $checked++
        $item = Get-Item -LiteralPath $fullPath
        if ([int64]$item.Length -ne [int64]$entry.bytes) {
            $reasons.Add("size mismatch: $($entry.path)") | Out-Null
        }
        $actualHash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne ([string]$entry.sha256).ToLowerInvariant()) {
            $reasons.Add("hash mismatch: $($entry.path)") | Out-Null
        }
    }

    $actualPaths = @(Get-NativePayloadFiles -PayloadRoot $root | ForEach-Object { Get-NativeRelativePath -Root $root -Path $_.FullName })
    foreach ($actual in $actualPaths) {
        if (-not $manifestPaths.Contains($actual)) { $reasons.Add("unmanifested file: $actual") | Out-Null }
    }

    $releaseMetadataPath = Join-Path $root 'native-release.json'
    if (Test-Path -LiteralPath $releaseMetadataPath -PathType Leaf) {
        try {
            $releaseMetadata = Get-Content -LiteralPath $releaseMetadataPath -Raw | ConvertFrom-Json
            if ([string]$releaseMetadata.version -ne [string]$manifest.version) {
                $reasons.Add('native release version does not match manifest version') | Out-Null
            }
        }
        catch { $reasons.Add('native release metadata is invalid JSON') | Out-Null }
    }

    [pscustomobject]@{
        Ready = ($reasons.Count -eq 0)
        FilesChecked = $checked
        Version = [string]$manifest.version
        Reasons = @($reasons)
    }
}

