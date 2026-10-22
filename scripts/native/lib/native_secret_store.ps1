#Requires -Version 5.1

Set-StrictMode -Version Latest

function Set-NativeRestrictedAcl {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string] $Path)

    $item = Get-Item -LiteralPath $Path -Force
    $systemSid = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
    $administratorsSid = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')
    if ($item.PSIsContainer) {
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
        $propagation = [Security.AccessControl.PropagationFlags]::None
        foreach ($sid in @($systemSid, $administratorsSid)) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', $inheritance, $propagation, 'Allow')))
        }
    }
    else {
        $acl = New-Object Security.AccessControl.FileSecurity
        foreach ($sid in @($systemSid, $administratorsSid)) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'Allow')))
        }
    }
    $acl.SetAccessRuleProtection($true, $false)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Get-NativeSecretEntropy {
    param([Parameter(Mandatory = $true)][byte[]] $RandomEntropy, [Parameter(Mandatory = $true)][string] $Purpose)

    $purposeBytes = [Text.Encoding]::UTF8.GetBytes('S_Hospital/native-secret/v1/' + $Purpose)
    $combined = New-Object byte[] ($RandomEntropy.Length + $purposeBytes.Length)
    [Array]::Copy($RandomEntropy, 0, $combined, 0, $RandomEntropy.Length)
    [Array]::Copy($purposeBytes, 0, $combined, $RandomEntropy.Length, $purposeBytes.Length)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $sha.ComputeHash($combined) }
    finally { $sha.Dispose(); [Array]::Clear($combined, 0, $combined.Length) }
}

function Protect-NativeMachineSecret {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [Parameter(Mandatory = $true)][string] $Secret,
        [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9-]+$')][string] $Purpose,
        [switch] $SkipAclForSandbox
    )

    Add-Type -AssemblyName System.Security
    $directory = Split-Path $Path -Parent
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $randomEntropy = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($randomEntropy) } finally { $rng.Dispose() }
    $entropy = Get-NativeSecretEntropy -RandomEntropy $randomEntropy -Purpose $Purpose
    $plainBytes = [Text.Encoding]::UTF8.GetBytes($Secret)
    try {
        $cipher = [Security.Cryptography.ProtectedData]::Protect(
            $plainBytes,
            $entropy,
            [Security.Cryptography.DataProtectionScope]::LocalMachine
        )
        $record = [ordered]@{
            schema_version = 1
            protection = 'dpapi-local-machine'
            purpose = $Purpose
            entropy = [Convert]::ToBase64String($randomEntropy)
            cipher = [Convert]::ToBase64String($cipher)
        }
        $secureTemporaryDirectory = Join-Path $directory 'administrator-only'
        New-Item -ItemType Directory -Path $secureTemporaryDirectory -Force | Out-Null
        if (-not $SkipAclForSandbox) { Set-NativeRestrictedAcl -Path $secureTemporaryDirectory }
        $temporary = Join-Path $secureTemporaryDirectory ((Split-Path $Path -Leaf) + '.tmp-' + [guid]::NewGuid().ToString('N'))
        try {
            [IO.File]::Create($temporary).Dispose()
            [IO.File]::WriteAllText($temporary, ($record | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
            Move-Item -LiteralPath $temporary -Destination $Path -Force
        }
        finally {
            if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        }
        if (-not $SkipAclForSandbox) {
            Set-NativeRestrictedAcl -Path $Path
        }
    }
    finally {
        [Array]::Clear($plainBytes, 0, $plainBytes.Length)
        [Array]::Clear($entropy, 0, $entropy.Length)
        [Array]::Clear($randomEntropy, 0, $randomEntropy.Length)
    }
}

function Unprotect-NativeMachineSecret {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9-]+$')][string] $Purpose
    )

    Add-Type -AssemblyName System.Security
    $record = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($record.schema_version -ne 1 -or $record.protection -ne 'dpapi-local-machine' -or $record.purpose -ne $Purpose) {
        throw 'Protected secret identity does not match the requested purpose.'
    }
    $randomEntropy = [Convert]::FromBase64String([string]$record.entropy)
    $cipher = [Convert]::FromBase64String([string]$record.cipher)
    $entropy = Get-NativeSecretEntropy -RandomEntropy $randomEntropy -Purpose $Purpose
    $plainBytes = $null
    try {
        $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect(
            $cipher,
            $entropy,
            [Security.Cryptography.DataProtectionScope]::LocalMachine
        )
        [Text.Encoding]::UTF8.GetString($plainBytes)
    }
    finally {
        if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
        [Array]::Clear($cipher, 0, $cipher.Length)
        [Array]::Clear($entropy, 0, $entropy.Length)
        [Array]::Clear($randomEntropy, 0, $randomEntropy.Length)
    }
}
