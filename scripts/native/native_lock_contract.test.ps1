#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_lock.ps1')

$child = $null
$first = Enter-NativeRuntimeMutationLock
try {
    $child = Join-Path $env:TEMP ('s-hospital-lock-child-' + [guid]::NewGuid().ToString('N') + '.ps1')
    @"
`$ErrorActionPreference='Stop'
. '$((Join-Path $PSScriptRoot 'lib\native_lock.ps1').Replace("'","''"))'
try { Enter-NativeRuntimeMutationLock | Out-Null; exit 0 } catch { exit 23 }
"@ | Set-Content -LiteralPath $child -Encoding UTF8
    & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -File $child
    if ($LASTEXITCODE -ne 23) { throw 'Concurrent native mutation was not rejected.' }
}
finally {
    Exit-NativeRuntimeMutationLock -Mutex $first
    if ($child -and (Test-Path -LiteralPath $child)) { Remove-Item -LiteralPath $child -Force }
}
$second = Enter-NativeRuntimeMutationLock
Exit-NativeRuntimeMutationLock -Mutex $second
'PASS native mutation lock rejects concurrency and releases cleanly'
