#Requires -Version 5.1

Set-StrictMode -Version Latest

function Get-NativeInstallLayout {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $InstallRoot,
        [Parameter(Mandatory = $true)][string] $DataRoot,
        [Parameter(Mandatory = $true)][ValidatePattern('^[0-9A-Za-z][0-9A-Za-z._-]+$')][string] $Version,
        [ValidatePattern('^[0-9A-Za-z][0-9A-Za-z._-]+$')][string] $ReleaseId
    )

    if ([string]::IsNullOrWhiteSpace($ReleaseId)) { $ReleaseId = $Version }
    $releaseRoot = Join-Path (Join-Path $InstallRoot 'releases') $ReleaseId
    [pscustomobject]@{
        InstallRoot = $InstallRoot
        DataRoot = $DataRoot
        Version = $Version
        ReleaseId = $ReleaseId
        RuntimeRoot = Join-Path $releaseRoot 'runtime'
        ReleasesRoot = Join-Path $InstallRoot 'releases'
        ReleaseRoot = $releaseRoot
        CurrentPath = Join-Path $InstallRoot 'current'
        ServiceRoot = Join-Path $InstallRoot 'services'
        ConfigRoot = Join-Path $DataRoot 'config'
        DatabaseData = Join-Path $DataRoot 'database'
        StorageRoot = Join-Path $DataRoot 'storage'
        CacheRoot = Join-Path $DataRoot 'cache'
        BackupRoot = Join-Path $DataRoot 'backups'
        LogRoot = Join-Path $DataRoot 'logs'
        StateRoot = Join-Path $DataRoot 'state'
        StagingRoot = Join-Path (Join-Path $DataRoot 'staging') $ReleaseId
        BackendRoot = Join-Path $releaseRoot 'app\backend'
    }
}

