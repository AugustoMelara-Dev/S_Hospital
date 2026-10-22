#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_update_policy.ps1')

$root = Join-Path $env:TEMP ('s-hospital-update-policy-' + [guid]::NewGuid().ToString('N'))
try {
    $old = Join-Path $root 'old'
    $candidate = Join-Path $root 'candidate'
    New-Item -ItemType Directory -Path $old,$candidate -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $old '0001_existing.php') -Value '<?php return true;' -Encoding ASCII
    Copy-Item -LiteralPath (Join-Path $old '0001_existing.php') -Destination (Join-Path $candidate '0001_existing.php')
    Set-Content -LiteralPath (Join-Path $candidate '0002_additive.php') -Value '<?php return true;' -Encoding ASCII

    $blocked = $false
    try { Test-NativeDatabaseUpdateCompatibility -CurrentMigrationsRoot $old -CandidateMigrationsRoot $candidate -Policy no_schema_change | Out-Null }
    catch { $blocked = $_.Exception.Message -match 'not declared backward-compatible additive' }
    if (-not $blocked) { throw 'Default update policy accepted a new migration.' }

    $compatible = Test-NativeDatabaseUpdateCompatibility -CurrentMigrationsRoot $old -CandidateMigrationsRoot $candidate -Policy backward_compatible_additive
    if ($compatible.AddedMigrations -notcontains '0002_additive.php' -or -not $compatible.BackwardCodeCompatible) { throw 'Reviewed additive migration was not reported as compatible.' }

    Set-Content -LiteralPath (Join-Path $candidate '0001_existing.php') -Value '<?php return false;' -Encoding ASCII
    $mutationBlocked = $false
    try { Test-NativeDatabaseUpdateCompatibility -CurrentMigrationsRoot $old -CandidateMigrationsRoot $candidate -Policy backward_compatible_additive | Out-Null }
    catch { $mutationBlocked = $_.Exception.Message -match 'modifies an installed migration' }
    if (-not $mutationBlocked) { throw 'Policy accepted a modified installed migration.' }
    'PASS native update database compatibility policy'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
