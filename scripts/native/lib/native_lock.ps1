#Requires -Version 5.1

Set-StrictMode -Version Latest

function Enter-NativeRuntimeMutationLock {
    [CmdletBinding()]
    param([int] $TimeoutMilliseconds = 0)

    $mutex = New-Object Threading.Mutex($false, 'Global\S_Hospital.Native.RuntimeMutation')
    try {
        try { $acquired = $mutex.WaitOne($TimeoutMilliseconds) }
        catch [Threading.AbandonedMutexException] { $acquired = $true }
        if (-not $acquired) {
            $mutex.Dispose()
            throw 'Another S_Hospital installation or update is already changing the native runtime.'
        }
        return $mutex
    }
    catch {
        if ($mutex) { $mutex.Dispose() }
        throw
    }
}

function Exit-NativeRuntimeMutationLock {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)] $Mutex)

    try { $Mutex.ReleaseMutex() }
    finally { $Mutex.Dispose() }
}
