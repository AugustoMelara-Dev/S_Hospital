#Requires -Version 5.1

Set-StrictMode -Version Latest

function Remove-NativeUpdatePointer {
    param([Parameter(Mandatory=$true)][string]$Path)
    $item=Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if(-not$item.PSIsContainer-or($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0){throw'Refusing to remove an update pointer that is not a directory junction.'}
    [IO.Directory]::Delete([IO.Path]::GetFullPath($Path),$false)
}

function Get-NativeUpdatePointerTarget {
    param([Parameter(Mandatory = $true)][string] $Path)
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    $target = [string](@($item.Target)[0])
    if ([string]::IsNullOrWhiteSpace($target)) { throw "Native release pointer has no target: $Path" }
    if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path $Path -Parent) $target }
    [IO.Path]::GetFullPath($target).TrimEnd('\')
}

function Test-NativeUpdatePathBelowRoot {
    param([string] $Path, [string] $Root)
    $normalizedPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $normalizedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $normalizedPath.StartsWith($normalizedRoot, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-NativeUpdateReleaseMutationPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$ReleasesRoot,
        [switch]$AllowMissing
    )
    $root=[IO.Path]::GetFullPath($ReleasesRoot).TrimEnd('\')
    $candidate=[IO.Path]::GetFullPath($Path).TrimEnd('\')
    if($candidate.Equals($root,[StringComparison]::OrdinalIgnoreCase)-or-not(Test-NativeUpdatePathBelowRoot -Path $candidate -Root $root)){
        throw'Update release mutation path escapes the immutable releases directory.'
    }
    if(Test-Path -LiteralPath $candidate){
        $item=Get-Item -LiteralPath $candidate -Force
        if(-not$item.PSIsContainer-or($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw'Update release mutation path must be a regular directory.'}
        $resolved=[IO.Path]::GetFullPath((Resolve-Path -LiteralPath $candidate).Path).TrimEnd('\')
        if(-not(Test-NativeUpdatePathBelowRoot -Path $resolved -Root $root)){throw'Resolved update release mutation path escapes the immutable releases directory.'}
        return $resolved
    }
    if(-not$AllowMissing){throw'Update release mutation path does not exist.'}
    $candidate
}

function Invoke-NativeUpdateActivation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $CurrentPath,
        [Parameter(Mandatory = $true)][string] $CandidateRoot,
        [Parameter(Mandatory = $true)][string] $PreviousPointer,
        [Parameter(Mandatory = $true)][string] $NextPointer,
        [Parameter(Mandatory = $true)][string] $ReleasesRoot,
        [Parameter(Mandatory = $true)][scriptblock] $StopWriters,
        [Parameter(Mandatory = $true)][scriptblock] $PrepareOffline,
        [Parameter(Mandatory = $true)][scriptblock] $StartRuntime,
        [Parameter(Mandatory = $true)][scriptblock] $TestRuntimeHealth,
        [Parameter(Mandatory = $true)][scriptblock] $WritePhase,
        [scriptblock] $ValidateActivated = {},
        [scriptblock] $AfterPreviousSaved = {}
    )

    if (-not (Test-NativeUpdatePathBelowRoot -Path $CandidateRoot -Root $ReleasesRoot)) {
        throw 'Candidate release must be located below the immutable releases root.'
    }
    if (-not (Test-Path -LiteralPath $CurrentPath -PathType Container)) { throw 'Current native release pointer is missing.' }
    if (-not (Test-Path -LiteralPath $CandidateRoot -PathType Container)) { throw 'Candidate native release is missing.' }
    if (Test-Path -LiteralPath $PreviousPointer) { throw 'Rollback pointer already exists.' }
    if (Test-Path -LiteralPath $NextPointer) { Remove-NativeUpdatePointer -Path $NextPointer }

    $previousSaved = $false
    $previousTarget = ''
    try {
        & $StopWriters
        & $PrepareOffline

        New-Item -ItemType Junction -Path $NextPointer -Target $CandidateRoot | Out-Null
        Move-Item -LiteralPath $CurrentPath -Destination $PreviousPointer
        $previousSaved = $true
        $previousTarget = Get-NativeUpdatePointerTarget -Path $PreviousPointer
        if (-not (Test-NativeUpdatePathBelowRoot -Path $previousTarget -Root $ReleasesRoot)) {
            throw 'Previous release pointer resolves outside the immutable releases root.'
        }
        & $WritePhase 'previous_saved' $PreviousPointer $previousTarget
        & $AfterPreviousSaved

        Move-Item -LiteralPath $NextPointer -Destination $CurrentPath
        $selectedTarget = Get-NativeUpdatePointerTarget -Path $CurrentPath
        if (-not $selectedTarget.Equals(([IO.Path]::GetFullPath($CandidateRoot).TrimEnd('\')), [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Current release pointer did not select the validated candidate.'
        }
        & $WritePhase 'switched' $PreviousPointer $previousTarget

        & $StartRuntime
        if (-not (& $TestRuntimeHealth)) { throw 'Updated application did not pass its local health check.' }
        & $ValidateActivated
        [pscustomobject]@{ PreviousTarget = $previousTarget; PreviousPointer = $PreviousPointer }
    }
    catch {
        $failure = $_
        $rollbackStopFailure = $null
        try { & $StopWriters } catch { $rollbackStopFailure = $_ }
        if ($null -ne $rollbackStopFailure) {
            $availabilityRestored = $false
            try {
                if (-not (Test-Path -LiteralPath $CurrentPath) -and $previousSaved -and (Test-Path -LiteralPath $PreviousPointer)) {
                    Move-Item -LiteralPath $PreviousPointer -Destination $CurrentPath
                }
                & $StartRuntime
                $availabilityRestored = [bool](& $TestRuntimeHealth)
            } catch { $availabilityRestored = $false }
            & $WritePhase 'rollback_failed' $PreviousPointer $previousTarget
            $availability = if ($availabilityRestored) { 'The selected release was restarted, but rollback was not safe.' } else { 'Service health could not be restored.' }
            throw "Update failed and application writers could not be stopped for rollback. $availability Original failure: $($failure.Exception.Message). Stop failure: $($rollbackStopFailure.Exception.Message)"
        }
        try {
            if ($previousSaved -and (Test-Path -LiteralPath $PreviousPointer)) {
                if (Test-Path -LiteralPath $CurrentPath) {
                    $currentTarget = Get-NativeUpdatePointerTarget -Path $CurrentPath
                    $candidateTarget = [IO.Path]::GetFullPath($CandidateRoot).TrimEnd('\')
                    if (-not $currentTarget.Equals($candidateTarget, [StringComparison]::OrdinalIgnoreCase)) {
                        throw 'Rollback refused to replace an unrecognized current release pointer.'
                    }
                    Remove-NativeUpdatePointer -Path $CurrentPath
                }
                Move-Item -LiteralPath $PreviousPointer -Destination $CurrentPath
            }
            & $StartRuntime
            if (-not (& $TestRuntimeHealth)) { throw 'Previous application release did not recover local health.' }
            & $WritePhase 'rolled_back' '' $previousTarget
        }
        catch {
            & $WritePhase 'rollback_failed' $PreviousPointer $previousTarget
            throw "Update failed and automatic code rollback did not restore service health. Original failure: $($failure.Exception.Message). Rollback failure: $($_.Exception.Message)"
        }
        throw $failure
    }
    finally {
        if (Test-Path -LiteralPath $NextPointer) { Remove-NativeUpdatePointer -Path $NextPointer }
    }
}
