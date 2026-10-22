#Requires -Version 5.1
Set-StrictMode -Version Latest

$script:NativeFailedInitialRepairReleaseId='2026.09.28.5-9b637d42ed3a'
$script:NativeFailedServicesRepairReleaseId='2026.09.28.6-99fefd4d5400'
function Test-NativeFailedInitialRepairEligibility {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]$InstallState,
        [Parameter(Mandatory=$true)][string]$PreviousReleaseId,
        [Parameter(Mandatory=$true)][string]$CandidateVersion,
        [Parameter(Mandatory=$true)][string]$PreviousMariaDbVersion,
        [Parameter(Mandatory=$true)][string]$CandidateMariaDbVersion,
        [Parameter(Mandatory=$true)][string]$CandidateDatabasePolicy,
        [bool]$PreviousIntegrityReady,
        [bool]$SchemaCompatible,
        [bool]$PersistentConfigurationReady,
        [bool]$DatabaseFilesReady,
        [int]$InstalledServiceCount
    )
    [int]$InstallState.schema_version-eq2-and
    [string]$InstallState.status-eq'in_progress'-and
    [string]$InstallState.phase-eq'database_files_initialized'-and
    [string]$InstallState.release_id-eq$script:NativeFailedInitialRepairReleaseId-and
    $PreviousReleaseId-eq$script:NativeFailedInitialRepairReleaseId-and
    $CandidateVersion-eq'2026.09.28.6'-and
    $PreviousMariaDbVersion-eq$CandidateMariaDbVersion-and
    $CandidateDatabasePolicy-eq'no_schema_change'-and
    $PreviousIntegrityReady-and$SchemaCompatible-and$PersistentConfigurationReady-and$DatabaseFilesReady-and$InstalledServiceCount-eq0
}

function Test-NativeFailedServicesRepairEligibility {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]$InstallState,
        [Parameter(Mandatory=$true)][string]$PreviousReleaseId,
        [Parameter(Mandatory=$true)][string]$CandidateVersion,
        [Parameter(Mandatory=$true)][string]$PreviousMariaDbVersion,
        [Parameter(Mandatory=$true)][string]$CandidateMariaDbVersion,
        [Parameter(Mandatory=$true)][string]$CandidateDatabasePolicy,
        [bool]$PreviousIntegrityReady,
        [bool]$SchemaCompatible,
        [bool]$PersistentConfigurationReady,
        [bool]$DatabaseFilesReady,
        [int]$InstalledServiceCount,
        [bool]$ApplicationServiceAccountsRepairable,
        [bool]$DatabaseServiceAccountReady
    )
    [int]$InstallState.schema_version-eq2-and
    [string]$InstallState.status-eq'in_progress'-and
    [string]$InstallState.phase-eq'services_installed'-and
    [string]$InstallState.release_id-eq$script:NativeFailedServicesRepairReleaseId-and
    $PreviousReleaseId-eq$script:NativeFailedServicesRepairReleaseId-and
    $CandidateVersion-eq'2026.09.28.7'-and
    $PreviousMariaDbVersion-eq$CandidateMariaDbVersion-and
    $CandidateDatabasePolicy-eq'no_schema_change'-and
    $PreviousIntegrityReady-and$SchemaCompatible-and$PersistentConfigurationReady-and$DatabaseFilesReady-and
    $InstalledServiceCount-eq6-and$ApplicationServiceAccountsRepairable-and$DatabaseServiceAccountReady
}

function Assert-NativeInitialReleaseMutationPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$ReleasesRoot,
        [switch]$AllowMissing
    )
    $root=[IO.Path]::GetFullPath($ReleasesRoot).TrimEnd('\')
    $candidate=[IO.Path]::GetFullPath($Path).TrimEnd('\')
    if($candidate.Equals($root,[StringComparison]::OrdinalIgnoreCase)-or
       -not$candidate.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){
        throw'Release mutation path escapes the immutable releases directory.'
    }
    if(Test-Path -LiteralPath $candidate){
        $item=Get-Item -LiteralPath $candidate -Force
        if(-not$item.PSIsContainer-or($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){
            throw'Release mutation path must be a regular directory.'
        }
        $resolved=[IO.Path]::GetFullPath((Resolve-Path -LiteralPath $candidate).Path).TrimEnd('\')
        if(-not$resolved.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){
            throw'Resolved release mutation path escapes the immutable releases directory.'
        }
        return $resolved
    }
    if(-not$AllowMissing){throw'Release mutation path does not exist.'}
    $candidate
}

function Remove-NativeInitialJunction {
    param([Parameter(Mandatory=$true)][string]$Path)
    $item=Get-Item -LiteralPath $Path -Force
    if(-not$item.PSIsContainer-or($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0){throw'Refusing to remove a repair pointer that is not a directory junction.'}
    [IO.Directory]::Delete([IO.Path]::GetFullPath($Path),$false)
}

function Get-NativeInitialCurrentTarget {
    param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$ReleasesRoot)
    $item=Get-Item -LiteralPath $Path -Force
    if(($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0-or-not$item.Target){throw'Existing current path is not a release junction.'}
    $target=[string]@($item.Target)[0]
    if(-not[IO.Path]::IsPathRooted($target)){$target=Join-Path $item.Parent.FullName $target}
    $target=[IO.Path]::GetFullPath($target).TrimEnd('\')
    $prefix=[IO.Path]::GetFullPath($ReleasesRoot).TrimEnd('\')+'\'
    if(-not$target.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw'Existing current release escapes the immutable releases directory.'}
    $target
}

function Start-NativeInitialRepairActivation {
    [CmdletBinding()]
    param([string]$CurrentPath,[string]$CandidateRoot,[string]$ReleasesRoot)
    $candidate=[IO.Path]::GetFullPath($CandidateRoot).TrimEnd('\')
    $releasePrefix=[IO.Path]::GetFullPath($ReleasesRoot).TrimEnd('\')+'\'
    if(-not$candidate.StartsWith($releasePrefix,[StringComparison]::OrdinalIgnoreCase)-or-not(Test-Path -LiteralPath $candidate -PathType Container)){throw'Repair candidate is outside releases or missing.'}
    [void](Get-NativeInitialCurrentTarget -Path $CurrentPath -ReleasesRoot $ReleasesRoot)
    $previous=Join-Path (Split-Path $CurrentPath -Parent) ('current.preinstall-repair-'+[guid]::NewGuid().ToString('N'))
    Move-Item -LiteralPath $CurrentPath -Destination $previous
    try{
        New-Item -ItemType Junction -Path $CurrentPath -Target $candidate|Out-Null
        $active=Get-NativeInitialCurrentTarget -Path $CurrentPath -ReleasesRoot $ReleasesRoot
        if(-not$active.Equals($candidate,[StringComparison]::OrdinalIgnoreCase)){throw'Repair release activation did not select the validated candidate.'}
        [pscustomobject]@{CurrentPath=$CurrentPath;PreviousPointer=$previous;CandidateTarget=$candidate;ReleasesRoot=$ReleasesRoot}
    }
    catch{
        if(Test-Path -LiteralPath $CurrentPath){Remove-NativeInitialJunction -Path $CurrentPath}
        if(Test-Path -LiteralPath $previous){Move-Item -LiteralPath $previous -Destination $CurrentPath}
        throw
    }
}

function Restore-NativeInitialRepairActivation {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)]$Context)
    if(-not(Test-Path -LiteralPath $Context.PreviousPointer)){return}
    if(Test-Path -LiteralPath $Context.CurrentPath){
        $active=Get-NativeInitialCurrentTarget -Path $Context.CurrentPath -ReleasesRoot $Context.ReleasesRoot
        if(-not$active.Equals([string]$Context.CandidateTarget,[StringComparison]::OrdinalIgnoreCase)){throw'Repair rollback refused to replace an unrecognized current release.'}
        Remove-NativeInitialJunction -Path $Context.CurrentPath
    }
    Move-Item -LiteralPath $Context.PreviousPointer -Destination $Context.CurrentPath
}

function Complete-NativeInitialRepairActivation {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)]$Context)
    $active=Get-NativeInitialCurrentTarget -Path $Context.CurrentPath -ReleasesRoot $Context.ReleasesRoot
    if(-not$active.Equals([string]$Context.CandidateTarget,[StringComparison]::OrdinalIgnoreCase)){throw'Repair completion refused because candidate is not current.'}
    if(Test-Path -LiteralPath $Context.PreviousPointer){Remove-NativeInitialJunction -Path $Context.PreviousPointer}
}
