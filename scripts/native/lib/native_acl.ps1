#Requires -Version 5.1

Set-StrictMode -Version Latest

function Set-NativeAclProfile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [Parameter(Mandatory = $true)][ValidateSet('ApplicationRoot','RuntimeData','RuntimeConfig','AdministratorSecret')][string] $Profile,
        [switch] $SelfOnly
    )

    if (-not (Test-Path -LiteralPath $Path)) { throw "Cannot secure missing path: $Path" }
    $isDirectory = (Get-Item -LiteralPath $Path -Force).PSIsContainer
    $inheritance = if ($isDirectory) { '(OI)(CI)' } else { '' }
    $grants = switch ($Profile) {
        'ApplicationRoot' {
            @(
                "*S-1-5-18:${inheritance}F",
                "*S-1-5-32-544:${inheritance}F",
                "*S-1-5-19:${inheritance}RX",
                "*S-1-5-32-545:${inheritance}RX"
            )
        }
        'RuntimeData' {
            @(
                "*S-1-5-18:${inheritance}F",
                "*S-1-5-32-544:${inheritance}F",
                "*S-1-5-19:${inheritance}M"
            )
        }
        'RuntimeConfig' {
            @(
                "*S-1-5-18:${inheritance}F",
                "*S-1-5-32-544:${inheritance}F",
                "*S-1-5-19:${inheritance}RX"
            )
        }
        'AdministratorSecret' {
            @(
                "*S-1-5-18:${inheritance}F",
                "*S-1-5-32-544:${inheritance}F"
            )
        }
    }
    # Apply the inheritable ACL to the directory itself first. Passing /T with
    # only (OI)(CI) grants makes icacls remove inheritance from child files and
    # can leave those files with an empty DACL. Reset descendants afterwards so
    # files receive effective inherited ACEs and child directories keep OI/CI.
    $arguments = @($Path, '/inheritance:r', '/grant:r') + $grants
    & (Join-Path $env:SystemRoot 'System32\icacls.exe') @arguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to apply ACL profile '$Profile' to '$Path' (icacls $LASTEXITCODE)." }
    if ($isDirectory -and -not $SelfOnly -and @(Get-ChildItem -LiteralPath $Path -Force).Count -gt 0) {
        & (Join-Path $env:SystemRoot 'System32\icacls.exe') (Join-Path $Path '*') '/reset' '/T' '/Q' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to propagate ACL profile '$Profile' below '$Path' (icacls $LASTEXITCODE)." }
    }
    $ownerArguments = @($Path, '/setowner', '*S-1-5-32-544')
    if ($isDirectory -and -not $SelfOnly) { $ownerArguments += @('/T', '/C', '/Q') }
    & (Join-Path $env:SystemRoot 'System32\icacls.exe') @ownerArguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to set a trusted owner on '$Path' (icacls $LASTEXITCODE)." }
    $ownerSid = (Get-Acl -LiteralPath $Path).GetOwner([Security.Principal.SecurityIdentifier]).Value
    if (@('S-1-5-18','S-1-5-32-544') -notcontains $ownerSid) {
        throw "Path owner is not SYSTEM or Administrators after ACL hardening: $Path"
    }
}

function Set-NativeRuntimeConfigurationAcl {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string] $ConfigRoot)

    if (-not (Test-Path -LiteralPath $ConfigRoot -PathType Container)) {
        throw "Cannot secure missing runtime configuration root: $ConfigRoot"
    }
    Set-NativeAclProfile -Path $ConfigRoot -Profile RuntimeConfig -SelfOnly

    $administratorDirectory = Join-Path $ConfigRoot 'administrator-only'
    $databaseSecret = Join-Path $ConfigRoot 'database-admin.dpapi'
    $protectedPrefix = [IO.Path]::GetFullPath($administratorDirectory).TrimEnd('\') + '\'
    foreach ($item in @(Get-ChildItem -LiteralPath $ConfigRoot -Force -Recurse | Sort-Object { $_.FullName.Length })) {
        $fullPath = [IO.Path]::GetFullPath($item.FullName)
        if ($fullPath.Equals([IO.Path]::GetFullPath($administratorDirectory), [StringComparison]::OrdinalIgnoreCase) -or
            $fullPath.StartsWith($protectedPrefix, [StringComparison]::OrdinalIgnoreCase) -or
            $fullPath.Equals([IO.Path]::GetFullPath($databaseSecret), [StringComparison]::OrdinalIgnoreCase)) {
            continue
        }
        Set-NativeAclProfile -Path $item.FullName -Profile RuntimeConfig -SelfOnly
    }
    foreach ($administratorPath in @($administratorDirectory, $databaseSecret)) {
        if (Test-Path -LiteralPath $administratorPath) {
            Set-NativeAclProfile -Path $administratorPath -Profile AdministratorSecret
        }
    }
}
