#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PayloadRoot,
    [string] $InstallRoot = (Join-Path $env:ProgramFiles 'S_Hospital'),
    [string] $DataRoot = (Join-Path $env:ProgramData 'S_Hospital'),
    [switch] $WhatIfOnly,
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
. (Join-Path $PSScriptRoot 'lib\native_layout.ps1')
. (Join-Path $PSScriptRoot 'lib\native_acl.ps1')
. (Join-Path $PSScriptRoot 'lib\native_cache.ps1')
. (Join-Path $PSScriptRoot 'lib\native_dotenv.ps1')
. (Join-Path $PSScriptRoot 'lib\native_prerequisites.ps1')
. (Join-Path $PSScriptRoot 'lib\native_config.ps1')
. (Join-Path $PSScriptRoot 'lib\native_elevated_php.ps1')
. (Join-Path $PSScriptRoot 'lib\native_lock.ps1')
. (Join-Path $PSScriptRoot 'lib\native_update_engine.ps1')
. (Join-Path $PSScriptRoot 'lib\native_update_policy.ps1')

function Wait-NativeServiceStatus {
    param([string[]] $Names, [string] $Status, [int] $TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $states = @(Get-Service -Name $Names -ErrorAction Stop)
        if (@($states | Where-Object { $_.Status.ToString() -ne $Status }).Count -eq 0) { return $true }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    $false
}

function Wait-NativeHttpHealth {
    param([string] $Url, [int] $TimeoutSeconds = 45)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try { if ((Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return $true } } catch { }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    $false
}

function Get-NativeEnvironmentValue {
    param([string] $Path, [string] $Name)
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $separator = $line.IndexOf('=')
        if ($separator -gt 0 -and $line.Substring(0, $separator).Trim() -eq $Name) {
            return ConvertFrom-NativeDotEnvValue $line.Substring($separator + 1).Trim()
        }
    }
    throw "Required runtime setting '$Name' is missing."
}

function Write-NativeUpdateState {
    param([string] $Path, [string] $Version, [string] $ReleaseId, [string] $Phase, [string] $Status = 'in_progress', [string] $PreviousPointer = '', [string] $PreviousTarget = '')
    $record = [ordered]@{ schema_version = 2; version = $Version; release_id = $ReleaseId; phase = $Phase; status = $Status; previous_pointer = $PreviousPointer; previous_target = $PreviousTarget; updated_at_utc = (Get-Date).ToUniversalTime().ToString('o') }
    $temporary = $Path + '.tmp'
    $record | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Write-NativeInstallCompletion {
    param([string] $StateRoot, [string] $Version, [string] $ReleaseId)
    $path = Join-Path $StateRoot 'native-install-state.json'
    $temporary = $path + '.tmp'
    [ordered]@{ schema_version = 2; version = $Version; release_id = $ReleaseId; phase = 'completed'; status = 'complete'; updated_at_utc = (Get-Date).ToUniversalTime().ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $path -Force
}

function Get-NativeJunctionTarget {
    param([Parameter(Mandatory = $true)][string] $Path)
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    $target = [string](@($item.Target)[0])
    if ([string]::IsNullOrWhiteSpace($target)) { throw "Native release pointer has no target: $Path" }
    if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path $Path -Parent) $target }
    [IO.Path]::GetFullPath($target).TrimEnd('\')
}

$payload = (Resolve-Path -LiteralPath $PayloadRoot).Path
$validation = Test-NativePayloadManifest -PayloadRoot $payload
if (-not $validation.Ready) { throw "Native update payload validation failed: $($validation.Reasons -join '; ')" }
$payloadIdentity = Get-NativePayloadIdentity -PayloadRoot $payload
$layout = Get-NativeInstallLayout -InstallRoot $InstallRoot -DataRoot $DataRoot -Version $validation.Version -ReleaseId $payloadIdentity.ReleaseId
$updateStatePath = Join-Path $layout.StateRoot 'native-update-state.json'
$plan = [pscustomobject]@{
    Version = $validation.Version
    ReleaseRoot = $layout.ReleaseRoot
    Steps = @(
        'validate-elevation',
        'validate-manifest-integrity',
        'reject-downgrade-and-mutated-migrations',
        'stage-versioned-release',
        'stop-application-writers',
        'verify-definitive-offline-backup',
        'run-migrations',
        'switch-current-release',
        'start-services',
        'verify-health',
        'verify-post-update-backup'
    )
    Rollback = [pscustomobject]@{
        CodeRelease = 'previous-junction'
        Database = 'encrypted-pre-migration-backup; standard packages require no schema change or reviewed backward-compatible additive migrations'
        AutomaticDatabaseRollback = $false
    }
}
if ($WhatIfOnly) {
    if ($Json) { $plan | ConvertTo-Json -Depth 5 } else { $plan }
    exit 0
}

$nativeMutationLock = Enter-NativeRuntimeMutationLock

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Native update requires an elevated Windows administrator session.' }
Set-NativeRuntimeConfigurationAcl -ConfigRoot (Join-Path $DataRoot 'config')
$releaseMetadata = Get-Content -LiteralPath (Join-Path $payload 'native-release.json') -Raw | ConvertFrom-Json
$prerequisite = Install-NativeVisualCppRuntime `
    -InstallerPath (Join-Path $payload 'runtime\vcredist\vc_redist.x64.exe') `
    -RequiredVersion ([version]$releaseMetadata.runtime_versions.vcredist) `
    -LogPath (Join-Path $env:TEMP ('S_Hospital-vcredist-update-' + [guid]::NewGuid().ToString('N') + '.log'))
$restartMarker = Join-Path $layout.StateRoot 'restart-required-after-install'
if ($prerequisite.RestartRequired) {
    Set-Content -LiteralPath $restartMarker -Value 'Microsoft Visual C++ runtime requested a restart.' -Encoding UTF8
}
elseif (Test-Path -LiteralPath $restartMarker -PathType Leaf) {
    Remove-Item -LiteralPath $restartMarker -Force
}
$current = Join-Path $InstallRoot 'current'
$serviceIds = @('SHospitalWeb','SHospitalPhp','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')
$serviceStartOrder = @('SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')
$sc = Join-Path $env:SystemRoot 'System32\sc.exe'
$appUrl = Get-NativeEnvironmentValue -Path (Join-Path $DataRoot 'config\hospital.env') -Name 'APP_URL'

function Restore-NativeApplicationServices {
    foreach ($serviceId in $serviceStartOrder) {
        $service = Get-Service -Name $serviceId -ErrorAction Stop
        if ($service.Status -ne 'Running') {
            & $sc start $serviceId | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Recovered service '$serviceId' failed to start." }
        }
    }
    if (-not (Wait-NativeServiceStatus -Names $serviceIds -Status 'Running' -TimeoutSeconds 30)) {
        throw 'Recovered application services did not remain running.'
    }
    if (-not (Wait-NativeHttpHealth -Url ($appUrl.TrimEnd('/') + '/up') -TimeoutSeconds 45)) {
        throw 'Recovered application did not pass its local health check.'
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $DataRoot 'database\mysql') -PathType Container)) { throw 'Native database is not initialized; update is not applicable.' }
$updateState = if (Test-Path -LiteralPath $updateStatePath -PathType Leaf) { Get-Content -LiteralPath $updateStatePath -Raw | ConvertFrom-Json } else { $null }
$updateStateReleaseId = if ($updateState -and $updateState.PSObject.Properties.Name -contains 'release_id') { [string]$updateState.release_id } else { '' }
if ($updateState -and $updateState.status -in @('in_progress','attention_required') -and $updateStateReleaseId -ne $layout.ReleaseId) {
    throw "Incomplete update '$($updateState.version)' must be recovered before applying release '$($layout.ReleaseId)'."
}
$currentPayloadIdentity = $null
if (Test-Path -LiteralPath $current -PathType Container) {
    try { $currentPayloadIdentity = Get-NativePayloadIdentity -PayloadRoot $current } catch { $currentPayloadIdentity = $null }
}
$payloadAlreadyCurrent = $null -ne $currentPayloadIdentity -and $currentPayloadIdentity.ContentSha256 -eq $payloadIdentity.ContentSha256
$updateInProgress = $updateState -and $updateState.status -in @('in_progress','attention_required')
if ($payloadAlreadyCurrent -and -not $updateInProgress) {
    $currentTarget = Get-NativeJunctionTarget -Path $current
    if (-not $currentTarget.Equals(([IO.Path]::GetFullPath($layout.ReleaseRoot).TrimEnd('\')), [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Completed update journal does not match the active release pointer.'
    }
    Restore-NativeApplicationServices
    Write-NativeInstallCompletion -StateRoot $layout.StateRoot -Version $validation.Version -ReleaseId $layout.ReleaseId
    $alreadyUpdated = [pscustomobject]@{ Ready = $true; Version = $layout.Version; ReleaseId = $layout.ReleaseId; AppUrl = $appUrl; Mode = 'native-update-existing'; PayloadAlreadyCurrent = $true; DatabasePreserved = $true; ConfigurationPreserved = $true }
    if ($Json) { $alreadyUpdated | ConvertTo-Json -Depth 3 } else { $alreadyUpdated }
    exit 0
}
if ($updateState -and $updateState.status -in @('in_progress','attention_required') -and @('switching','previous_saved','switched','recovering','recovery_failed','rollback_failed') -contains $updateState.phase) {
    $recordedPrevious = [string]$updateState.previous_pointer
    $recordedTarget = if ($updateState.PSObject.Properties.Name -contains 'previous_target') { [string]$updateState.previous_target } else { '' }
    $installPrefix = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\') + '\'
    $recordedPreviousFull = if ($recordedPrevious -ne '') { [IO.Path]::GetFullPath($recordedPrevious) } else { '' }
    if ($recordedPrevious -eq '' -or -not $recordedPreviousFull.StartsWith($installPrefix, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $recordedPreviousFull -Parent) -ne [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\') -or (Split-Path $recordedPreviousFull -Leaf) -notlike 'current.previous-*') {
        throw 'Interrupted update has no valid previous release pointer for automatic recovery.'
    }
    if (Test-Path -LiteralPath $recordedPrevious) {
        $recordedTarget = Get-NativeJunctionTarget -Path $recordedPrevious
        if (-not (Test-NativeUpdatePathBelowRoot -Path $recordedTarget -Root $layout.ReleasesRoot)) { throw 'Interrupted update rollback pointer resolves outside the immutable releases root.' }
    }
    elseif (-not (Test-Path -LiteralPath $current)) {
        throw 'Interrupted update has neither the previous pointer nor a current release for automatic recovery.'
    }
    else {
        $currentTarget = Get-NativeJunctionTarget -Path $current
        $candidateTarget = [IO.Path]::GetFullPath($layout.ReleaseRoot).TrimEnd('\')
        $isRecordedPrevious = -not [string]::IsNullOrWhiteSpace($recordedTarget) -and $currentTarget.Equals(([IO.Path]::GetFullPath($recordedTarget).TrimEnd('\')), [StringComparison]::OrdinalIgnoreCase)
        $isLegacyUnswitched = @('switching','previous_saved') -contains [string]$updateState.phase -and -not $currentTarget.Equals($candidateTarget, [StringComparison]::OrdinalIgnoreCase)
        if (-not $isRecordedPrevious -and -not $isLegacyUnswitched) {
            throw 'Interrupted update current pointer cannot be proven to be the previous release.'
        }
    }
    try {
        foreach ($serviceId in $serviceIds) { & $sc stop $serviceId | Out-Null }
        if (-not (Wait-NativeServiceStatus -Names $serviceIds -Status 'Stopped' -TimeoutSeconds 30)) { throw 'Interrupted update recovery could not stop all application writers.' }
    }
    catch {
        $partialStopFailure = $_
        $partialStopRecovered = $false
        try { Restore-NativeApplicationServices; $partialStopRecovered = $true } catch { }
        Write-NativeUpdateState -Path $updateStatePath -Version $validation.Version -ReleaseId $layout.ReleaseId -Phase 'recovery_failed' -Status 'attention_required' -PreviousPointer $recordedPrevious -PreviousTarget $recordedTarget
        if (-not $partialStopRecovered) { throw "Interrupted update recovery only stopped part of the application and could not restore service health: $($partialStopFailure.Exception.Message)" }
        throw $partialStopFailure
    }
    try {
        if (Test-Path -LiteralPath $recordedPrevious) {
            Write-NativeUpdateState -Path $updateStatePath -Version $validation.Version -ReleaseId $layout.ReleaseId -Phase 'recovering' -PreviousPointer $recordedPrevious -PreviousTarget $recordedTarget
            if (Test-Path -LiteralPath $current) {
                $activeDuringRecovery = Get-NativeJunctionTarget -Path $current
                if (-not (Test-NativeUpdatePathBelowRoot -Path $activeDuringRecovery -Root $layout.ReleasesRoot)) { throw 'Interrupted update current pointer resolves outside the immutable releases root.' }
                if (-not $activeDuringRecovery.Equals(([IO.Path]::GetFullPath($layout.ReleaseRoot).TrimEnd('\')), [StringComparison]::OrdinalIgnoreCase)) { throw 'Interrupted update refused to replace an unrecognized active release.' }
                Remove-NativeUpdatePointer -Path $current
            }
            Move-Item -LiteralPath $recordedPrevious -Destination $current
        }
        Restore-NativeApplicationServices
        Write-NativeUpdateState -Path $updateStatePath -Version $validation.Version -ReleaseId $layout.ReleaseId -Phase 'recovered_previous' -Status 'rolled_back'
        $updateState = $null
    }
    catch {
        $recoveryFailure = $_
        $recoveryServiceRestored = $false
        try {
            if (-not (Test-Path -LiteralPath $current) -and (Test-Path -LiteralPath $recordedPrevious)) { Move-Item -LiteralPath $recordedPrevious -Destination $current }
            if (Test-Path -LiteralPath $current) {
                $recoverableTarget = Get-NativeJunctionTarget -Path $current
                if (-not (Test-NativeUpdatePathBelowRoot -Path $recoverableTarget -Root $layout.ReleasesRoot)) { throw 'No recognized current release remains after interrupted recovery.' }
                Restore-NativeApplicationServices
                $recoveryServiceRestored = $true
            }
        } catch { }
        Write-NativeUpdateState -Path $updateStatePath -Version $validation.Version -ReleaseId $layout.ReleaseId -Phase 'recovery_failed' -Status 'attention_required' -PreviousPointer $recordedPrevious -PreviousTarget $recordedTarget
        if (-not $recoveryServiceRestored) { throw "Interrupted update recovery failed and service health could not be restored: $($recoveryFailure.Exception.Message)" }
        throw $recoveryFailure
    }
}
if (-not (Test-Path -LiteralPath $current)) {
    $previousPointers = @(Get-ChildItem -LiteralPath $InstallRoot -Directory -Filter 'current.previous-*' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending)
    if ($previousPointers.Count -eq 0) { throw 'Current native release pointer is missing and no rollback pointer is available.' }
    $fallbackTarget = Get-NativeJunctionTarget -Path $previousPointers[0].FullName
    if (-not (Test-NativeUpdatePathBelowRoot -Path $fallbackTarget -Root $layout.ReleasesRoot)) { throw 'Fallback rollback pointer resolves outside the immutable releases root.' }
    Move-Item -LiteralPath $previousPointers[0].FullName -Destination $current
    Restore-NativeApplicationServices
}
$orphanNext = Join-Path $InstallRoot 'current.next'
if (Test-Path -LiteralPath $orphanNext) { Remove-Item -LiteralPath $orphanNext -Force }
$currentTargetBeforeUpdate = Get-NativeJunctionTarget -Path $current
if (-not (Test-NativeUpdatePathBelowRoot -Path $currentTargetBeforeUpdate -Root $layout.ReleasesRoot)) { throw 'Current release pointer resolves outside the immutable releases root.' }
$releaseAlreadyStaged = Test-Path -LiteralPath $layout.ReleaseRoot -PathType Container
if ($releaseAlreadyStaged) {
    $stagedValidation = Test-NativePayloadManifest -PayloadRoot $layout.ReleaseRoot
    $stagedIdentity = if ($stagedValidation.Ready) { Get-NativePayloadIdentity -PayloadRoot $layout.ReleaseRoot } else { $null }
    if (-not $stagedValidation.Ready -or $null -eq $stagedIdentity -or $stagedIdentity.ContentSha256 -ne $payloadIdentity.ContentSha256) {
        throw 'Existing candidate release is incomplete or does not match the exact update payload.'
    }
}

$oldReleaseInfoPath = Join-Path $current 'native-release.json'
$newReleaseInfoPath = Join-Path $payload 'native-release.json'
if (-not (Test-Path -LiteralPath $oldReleaseInfoPath -PathType Leaf) -or -not (Test-Path -LiteralPath $newReleaseInfoPath -PathType Leaf)) {
    throw 'Runtime version metadata is required for a safe native update.'
}
$oldInfo = Get-Content -LiteralPath $oldReleaseInfoPath -Raw | ConvertFrom-Json
$newInfo = Get-Content -LiteralPath $newReleaseInfoPath -Raw | ConvertFrom-Json
try {
    $oldProductVersion = [version]([string]$oldInfo.version)
    $newProductVersion = [version]([string]$newInfo.version)
}
catch { throw 'Installed and update package versions must use numeric dotted version identifiers.' }
if ($newProductVersion -lt $oldProductVersion) {
    throw "Downgrade from '$oldProductVersion' to '$newProductVersion' is blocked to protect persistent data."
}
if ($oldInfo.runtime_versions.mariadb -ne $newInfo.runtime_versions.mariadb) {
    throw 'This update changes MariaDB. Use a database-runtime migration package instead of the standard updater.'
}

$databaseUpdatePolicy = if ($newInfo.PSObject.Properties.Name -contains 'database_update_policy') { [string]$newInfo.database_update_policy } else { 'no_schema_change' }
$databaseCompatibility = Test-NativeDatabaseUpdateCompatibility -CurrentMigrationsRoot (Join-Path $current 'app\backend\database\migrations') -CandidateMigrationsRoot (Join-Path $payload 'app\backend\database\migrations') -Policy $databaseUpdatePolicy
$addedMigrations = @($databaseCompatibility.AddedMigrations)
if ($databaseUpdatePolicy -eq 'no_schema_change') {
    $migrationStatusScript = Join-Path $current 'scripts\native\invoke_native_artisan.ps1'
    $migrationStatus = @(& $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $migrationStatusScript -Action migration-status -InstallRoot $InstallRoot -DataRoot $DataRoot)
    $migrationStatusExit = $LASTEXITCODE
    if ($migrationStatusExit -eq 2) { throw 'Installed database has pending migrations; no-schema-change update refused.' }
    if ($migrationStatusExit -ne 0) { throw 'Installed migration status could not be verified before a no-schema-change update.' }
}

if (-not $releaseAlreadyStaged) {
    $candidateRoot = Join-Path $layout.ReleasesRoot ('.candidate-update-' + $layout.ReleaseId)
    if (Test-Path -LiteralPath $candidateRoot) {
        $candidateToRemove=Assert-NativeUpdateReleaseMutationPath -Path $candidateRoot -ReleasesRoot $layout.ReleasesRoot
        Remove-Item -LiteralPath $candidateToRemove -Recurse -Force
    }
    $candidateRoot=Assert-NativeUpdateReleaseMutationPath -Path $candidateRoot -ReleasesRoot $layout.ReleasesRoot -AllowMissing
    New-Item -ItemType Directory -Path $candidateRoot -Force | Out-Null
    Get-ChildItem -LiteralPath $payload -Force | Copy-Item -Destination $candidateRoot -Recurse -Force
    $candidateValidation = Test-NativePayloadManifest -PayloadRoot $candidateRoot
    if (-not $candidateValidation.Ready) { throw "Staged update payload is invalid: $($candidateValidation.Reasons -join '; ')" }
    $candidateToMove=Assert-NativeUpdateReleaseMutationPath -Path $candidateRoot -ReleasesRoot $layout.ReleasesRoot
    $releaseDestination=Assert-NativeUpdateReleaseMutationPath -Path $layout.ReleaseRoot -ReleasesRoot $layout.ReleasesRoot -AllowMissing
    if(Test-Path -LiteralPath $releaseDestination){throw'Update release destination unexpectedly exists after candidate validation.'}
    Move-Item -LiteralPath $candidateToMove -Destination $releaseDestination
}
Set-NativeAclProfile -Path $InstallRoot -Profile ApplicationRoot
$runtimeProbeContext = New-NativeElevatedPhpContext -Layout $layout -ReleaseRoot $layout.ReleaseRoot
try {
    Test-NativeBundledRuntimeDependencies -ReleaseRoot $layout.ReleaseRoot -PhpIniPath $runtimeProbeContext.PhpIniPath | Out-Null
}
finally { Remove-NativeElevatedPhpContext -Context $runtimeProbeContext }

$previousPointer = Join-Path $InstallRoot ('current.previous-' + [guid]::NewGuid().ToString('N'))
$nextPointer = Join-Path $InstallRoot 'current.next'
$updateArtifacts = [ordered]@{ PreBackup = $null; PostBackup = $null }
$stopWriters = {
    foreach ($serviceId in $serviceIds) { & $sc stop $serviceId | Out-Null }
    if (-not (Wait-NativeServiceStatus -Names $serviceIds -Status 'Stopped' -TimeoutSeconds 30)) { throw 'Application writers did not stop; migration was not started.' }
}
$startRuntime = {
    foreach ($serviceId in $serviceStartOrder) {
        $service = Get-Service -Name $serviceId -ErrorAction Stop
        if ($service.Status -ne 'Running') {
            & $sc start $serviceId | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Application service '$serviceId' failed to start." }
        }
    }
    if (-not (Wait-NativeServiceStatus -Names $serviceIds -Status 'Running' -TimeoutSeconds 30)) { throw 'One or more application services did not remain running.' }
}
$testHealth = { Wait-NativeHttpHealth -Url ($appUrl.TrimEnd('/') + '/up') -TimeoutSeconds 45 }
$writePhase = {
    param($phase, $pointer, $target)
    $status = if ($phase -eq 'rolled_back') { 'rolled_back' } elseif ($phase -eq 'rollback_failed') { 'attention_required' } else { 'in_progress' }
    Write-NativeUpdateState -Path $updateStatePath -Version $validation.Version -ReleaseId $layout.ReleaseId -Phase $phase -Status $status -PreviousPointer $pointer -PreviousTarget $target
}
$prepareOffline = {
    $artisanCurrent = Join-Path $current 'scripts\native\invoke_native_artisan.ps1'
    $preBackupOutput = & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $artisanCurrent -Action backup-manual -InstallRoot $InstallRoot -DataRoot $DataRoot
    if ($LASTEXITCODE -ne 0) { throw 'Definitive offline pre-migration backup failed; update was not started.' }
    $preBackup = ($preBackupOutput -join "`n") | ConvertFrom-Json
    if ($preBackup.status -ne 'success' -or [string]::IsNullOrWhiteSpace([string]$preBackup.checksum_sha256) -or -not $preBackup.encrypted) {
        throw 'Pre-migration backup is not an encrypted successful backup.'
    }
    $migrationGateOutput = & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $artisanCurrent -Action verify-migration-backup -InstallRoot $InstallRoot -DataRoot $DataRoot
    if ($LASTEXITCODE -ne 0) { throw 'Pre-migration backup failed recoverability verification.' }
    $migrationGate = ($migrationGateOutput -join "`n") | ConvertFrom-Json
    if ($migrationGate.status -ne 'verified' -or $migrationGate.backup_log_id -ne $preBackup.backup_log_id) { throw 'Migration gate did not verify the exact backup created after writers stopped.' }
    $updateArtifacts.PreBackup = $preBackup
    Write-NativeUpdateState -Path $updateStatePath -Version $validation.Version -ReleaseId $layout.ReleaseId -Phase 'backup_verified'
    Clear-NativePersistentLaravelCaches -DataRoot $DataRoot

    $candidateArtisan = Join-Path $layout.ReleaseRoot 'scripts\native\invoke_native_artisan.ps1'
    & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $candidateArtisan -Action migrate -InstallRoot $InstallRoot -DataRoot $DataRoot -ReleaseRoot $layout.ReleaseRoot
    if ($LASTEXITCODE -ne 0) { throw 'Candidate database migrations failed.' }
    & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $candidateArtisan -Action optimize -InstallRoot $InstallRoot -DataRoot $DataRoot -ReleaseRoot $layout.ReleaseRoot
    if ($LASTEXITCODE -ne 0) { throw 'Candidate optimization failed.' }
}
$validateActivated = {
    $postArtisan = Join-Path $current 'scripts\native\invoke_native_artisan.ps1'
    $postBackupOutput = & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $postArtisan -Action backup-manual -InstallRoot $InstallRoot -DataRoot $DataRoot
    if ($LASTEXITCODE -ne 0) { throw 'Post-update backup failed.' }
    $postBackup = ($postBackupOutput -join "`n") | ConvertFrom-Json
    if ($postBackup.status -ne 'success' -or [string]::IsNullOrWhiteSpace([string]$postBackup.checksum_sha256)) { throw 'Post-update backup was not verified.' }
    $postVerifyOutput = & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $postArtisan -Action verify-backup -BackupId $postBackup.backup_log_id -InstallRoot $InstallRoot -DataRoot $DataRoot
    if ($LASTEXITCODE -ne 0) { throw 'Post-update encrypted backup could not be fully verified.' }
    $postVerify = ($postVerifyOutput -join "`n") | ConvertFrom-Json
    if ($postVerify.status -ne 'verified' -or $postVerify.backup_log_id -ne $postBackup.backup_log_id) { throw 'Post-update verification did not verify the backup just created.' }
    $updateArtifacts.PostBackup = $postBackup
}

try {
    $activation = Invoke-NativeUpdateActivation -CurrentPath $current -CandidateRoot $layout.ReleaseRoot -PreviousPointer $previousPointer -NextPointer $nextPointer -ReleasesRoot $layout.ReleasesRoot -StopWriters $stopWriters -PrepareOffline $prepareOffline -StartRuntime $startRuntime -TestRuntimeHealth $testHealth -WritePhase $writePhase -ValidateActivated $validateActivated
    Write-NativeUpdateState -Path $updateStatePath -Version $validation.Version -ReleaseId $layout.ReleaseId -Phase 'completed' -Status 'complete'
    Write-NativeInstallCompletion -StateRoot $layout.StateRoot -Version $validation.Version -ReleaseId $layout.ReleaseId
    if (Test-Path -LiteralPath $previousPointer) { Remove-Item -LiteralPath $previousPointer -Force }
    $result = [pscustomobject]@{
        Ready = $true
        Version = $layout.Version
        ReleaseId = $layout.ReleaseId
        PreviousVersion = [string]$oldInfo.version
        AppUrl = $appUrl
        Mode = 'native-update'
        DatabasePreserved = $true
        ConfigurationPreserved = $true
        DatabaseUpdatePolicy = $databaseUpdatePolicy
        AddedMigrations = $addedMigrations
        PreMigrationBackup = [pscustomobject]@{ Filename = $updateArtifacts.PreBackup.filename; ChecksumSha256 = $updateArtifacts.PreBackup.checksum_sha256 }
        PostUpdateBackup = [pscustomobject]@{ Filename = $updateArtifacts.PostBackup.filename; ChecksumSha256 = $updateArtifacts.PostBackup.checksum_sha256 }
        PreviousReleaseRetained = $true
        PreviousReleasePath = $activation.PreviousTarget
    }
    if ($Json) { $result | ConvertTo-Json -Depth 5 } else { $result }
}
finally {
    Exit-NativeRuntimeMutationLock -Mutex $nativeMutationLock
}
