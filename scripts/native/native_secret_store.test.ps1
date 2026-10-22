#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$module = Join-Path $PSScriptRoot 'lib\native_secret_store.ps1'
if (-not (Test-Path -LiteralPath $module -PathType Leaf)) { throw "Missing native secret store: $module" }
. $module

$root = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-secret-' + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $path = Join-Path $root 'database-admin.dpapi'
    $secret = 'ROOT_SECRET_MUST_NOT_BE_PLAINTEXT_123!'
    Protect-NativeMachineSecret -Path $path -Secret $secret -Purpose 'database-admin' -SkipAclForSandbox
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Protected secret file was not created.' }
    if ((Get-Content -LiteralPath $path -Raw) -match [regex]::Escape($secret)) { throw 'Protected secret contains plaintext.' }
    $actual = Unprotect-NativeMachineSecret -Path $path -Purpose 'database-admin'
    if ($actual -ne $secret) { throw 'Protected secret did not round-trip.' }
    $failed = $false
    try { Unprotect-NativeMachineSecret -Path $path -Purpose 'different-purpose' | Out-Null } catch { $failed = $true }
    if (-not $failed) { throw 'Purpose mismatch must fail closed.' }
    Write-Host '[ OK ] Native machine secret store contract passed.'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
