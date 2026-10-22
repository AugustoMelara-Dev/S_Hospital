#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_update_engine.ps1')

function Assert-NativeUpdateEngine([bool] $Condition, [string] $Message) {
    if (-not $Condition) { throw $Message }
}

$root = Join-Path $env:TEMP ('s-hospital-update-engine-' + [guid]::NewGuid().ToString('N'))
try {
    $releases = Join-Path $root 'releases'
    $old = Join-Path $releases 'old-release'
    $candidate = Join-Path $releases 'new-release'
    New-Item -ItemType Directory -Path $old,$candidate -Force | Out-Null
    Assert-NativeUpdateEngine ((Assert-NativeUpdateReleaseMutationPath -Path $candidate -ReleasesRoot $releases) -eq [IO.Path]::GetFullPath($candidate)) 'Update mutation guard changed a valid release path.'
    Assert-NativeUpdateEngine ((Assert-NativeUpdateReleaseMutationPath -Path (Join-Path $releases 'future') -ReleasesRoot $releases -AllowMissing) -eq [IO.Path]::GetFullPath((Join-Path $releases 'future'))) 'Update mutation guard rejected a safe future release path.'
    $outsideRejected=$false
    try{[void](Assert-NativeUpdateReleaseMutationPath -Path (Join-Path $root 'outside') -ReleasesRoot $releases -AllowMissing)}catch{$outsideRejected=$true}
    Assert-NativeUpdateEngine $outsideRejected 'Update mutation guard accepted a path outside releases.'
    Set-Content -LiteralPath (Join-Path $old 'sentinel.txt') -Value 'old'
    Set-Content -LiteralPath (Join-Path $candidate 'sentinel.txt') -Value 'new'

    function Reset-Pointers {
        foreach ($path in @((Join-Path $root 'current'),(Join-Path $root 'current.next'))) {
            if (Test-Path -LiteralPath $path) { Remove-NativeUpdatePointer -Path $path }
        }
        foreach($previousPointer in @(Get-ChildItem -LiteralPath $root -Directory -Filter 'current.previous-*' -ErrorAction SilentlyContinue)){
            Remove-NativeUpdatePointer -Path $previousPointer.FullName
        }
        New-Item -ItemType Junction -Path (Join-Path $root 'current') -Target $old | Out-Null
    }

    $script:runtimeStarted = $false
    $script:healthValue = $true
    $script:phases = @()
    $stop = { $script:runtimeStarted = $false }
    $prepare = { Assert-NativeUpdateEngine (-not $script:runtimeStarted) 'Offline preparation ran while writers were active.' }
    $start = { $script:runtimeStarted = $true }
    $health = { $script:runtimeStarted -and $script:healthValue }
    $phase = { param($name,$pointer,$target) $script:phases += $name }

    Reset-Pointers
    $previous = Join-Path $root 'current.previous-success'
    Invoke-NativeUpdateActivation -CurrentPath (Join-Path $root 'current') -CandidateRoot $candidate -PreviousPointer $previous -NextPointer (Join-Path $root 'current.next') -ReleasesRoot $releases -StopWriters $stop -PrepareOffline $prepare -StartRuntime $start -TestRuntimeHealth $health -WritePhase $phase | Out-Null
    Assert-NativeUpdateEngine ((Get-NativeUpdatePointerTarget (Join-Path $root 'current')) -eq $candidate) 'Successful activation did not select candidate.'
    Assert-NativeUpdateEngine (Test-Path -LiteralPath $previous) 'Successful activation did not retain rollback pointer until caller commits.'

    Reset-Pointers
    $script:healthValue = $true
    $script:phases = @()
    $failedBetweenMoves = $false
    $betweenMovesMessage = ''
    try {
        Invoke-NativeUpdateActivation -CurrentPath (Join-Path $root 'current') -CandidateRoot $candidate -PreviousPointer (Join-Path $root 'current.previous-between') -NextPointer (Join-Path $root 'current.next') -ReleasesRoot $releases -StopWriters $stop -PrepareOffline $prepare -StartRuntime $start -TestRuntimeHealth $health -WritePhase $phase -AfterPreviousSaved { throw 'injected-between-moves' } | Out-Null
    } catch { $betweenMovesMessage = $_.Exception.ToString(); $failedBetweenMoves = $betweenMovesMessage -match 'injected-between-moves' }
    Assert-NativeUpdateEngine $failedBetweenMoves "Injected failure between pointer moves was not propagated. Observed: $betweenMovesMessage"
    Assert-NativeUpdateEngine ((Get-NativeUpdatePointerTarget (Join-Path $root 'current')) -eq $old) 'Failure between pointer moves did not restore old release.'
    Assert-NativeUpdateEngine ($script:phases -contains 'rolled_back') 'Failure between moves did not record rollback.'

    Reset-Pointers
    $script:healthValue = $false
    $script:healthCalls = 0
    $healthThenRecover = { $script:healthCalls++; $script:runtimeStarted -and $script:healthCalls -gt 1 }
    try {
        Invoke-NativeUpdateActivation -CurrentPath (Join-Path $root 'current') -CandidateRoot $candidate -PreviousPointer (Join-Path $root 'current.previous-health') -NextPointer (Join-Path $root 'current.next') -ReleasesRoot $releases -StopWriters $stop -PrepareOffline $prepare -StartRuntime $start -TestRuntimeHealth $healthThenRecover -WritePhase $phase | Out-Null
        throw 'Expected candidate health failure.'
    } catch {
        if ($_.Exception.Message -eq 'Expected candidate health failure.') { throw }
    }
    Assert-NativeUpdateEngine ((Get-NativeUpdatePointerTarget (Join-Path $root 'current')) -eq $old) 'Health failure did not restore old release.'
    Assert-NativeUpdateEngine ((Get-Content -LiteralPath (Join-Path $root 'current\sentinel.txt') -Raw).Trim() -eq 'old') 'Rollback did not preserve old release sentinel.'

    Reset-Pointers
    $script:runtimeStarted = $true
    $partialStopObserved = $false
    try {
        Invoke-NativeUpdateActivation -CurrentPath (Join-Path $root 'current') -CandidateRoot $candidate -PreviousPointer (Join-Path $root 'current.previous-partial-stop') -NextPointer (Join-Path $root 'current.next') -ReleasesRoot $releases -StopWriters { throw 'injected-partial-stop' } -PrepareOffline $prepare -StartRuntime $start -TestRuntimeHealth $health -WritePhase $phase | Out-Null
    } catch { $partialStopObserved = $_.Exception.Message -match 'writers could not be stopped' }
    Assert-NativeUpdateEngine $partialStopObserved 'Partial writer stop was not reported.'
    Assert-NativeUpdateEngine $script:runtimeStarted 'Partial writer stop did not restart the selected release.'
    Assert-NativeUpdateEngine ((Get-NativeUpdatePointerTarget (Join-Path $root 'current')) -eq $old) 'Partial writer stop changed the selected release.'
    'PASS native update engine pointer switch and rollback contract'
}
finally {
    if (Test-Path -LiteralPath $root) {
        foreach($pointer in @(Get-ChildItem -LiteralPath $root -Directory -Filter 'current*' -ErrorAction SilentlyContinue)){
            if(($pointer.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){Remove-NativeUpdatePointer -Path $pointer.FullName}
        }
        Remove-Item -LiteralPath $root -Recurse -Force
    }
}
