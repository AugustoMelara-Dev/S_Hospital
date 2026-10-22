#Requires -Version 5.1

[CmdletBinding()]
param(
    [string]$PreviousReleaseRoot,
    [string]$CandidateReleaseRoot
)

$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
. (Join-Path $PSScriptRoot 'lib\native_initial_repair.ps1')

if([string]::IsNullOrWhiteSpace($PreviousReleaseRoot)){$PreviousReleaseRoot=Join-Path (Split-Path $PSScriptRoot -Parent) '..\artifacts\native-payload-2026.09.28.3'}
if([string]::IsNullOrWhiteSpace($CandidateReleaseRoot)){$CandidateReleaseRoot=Join-Path (Split-Path $PSScriptRoot -Parent) '..\artifacts\native-payload-2026.09.28.4'}
$previous=(Resolve-Path -LiteralPath $PreviousReleaseRoot).Path
$candidate=(Resolve-Path -LiteralPath $CandidateReleaseRoot).Path
$artifactsRoot=[IO.Path]::GetFullPath((Split-Path $previous -Parent))
$temp=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-pre-db-transition-'+[guid]::NewGuid().ToString('N'))
$current=Join-Path $temp 'current'
try{
    New-Item -ItemType Directory -Path $temp|Out-Null
    New-Item -ItemType Junction -Path $current -Target $previous|Out-Null
    $resolved=Get-NativeInitialCurrentTarget -Path $current -ReleasesRoot $artifactsRoot
    if(-not$resolved.Equals($previous,[StringComparison]::OrdinalIgnoreCase)){throw'Historical current pointer did not resolve to the real previous-release fixture.'}

    $previousManifest=Get-Content -LiteralPath (Join-Path $resolved 'native-payload.manifest.json') -Raw|ConvertFrom-Json
    $previousManifestPaths=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach($entry in @($previousManifest.files)){[void]$previousManifestPaths.Add([string]$entry.path)}
    $strictReasons=@($script:NativeRequiredPayloadFiles|Where-Object{-not$previousManifestPaths.Contains($_)}|ForEach-Object{'required file missing from manifest: '+$_})
    $expectedCurrentOnly=@(
        'required file missing from manifest: scripts/native/diagnose_native_partial.ps1',
        'required file missing from manifest: scripts/native/lib/native_initial_repair.ps1'
    )
    if($strictReasons.Count-lt$expectedCurrentOnly.Count-or@($expectedCurrentOnly|Where-Object{$_ -notin $strictReasons}).Count-ne0){
        throw "Real previous fixture did not reproduce the current-policy mismatch exactly: $($strictReasons -join '; ')"
    }
    Write-Host '[checkpoint] Previous release reproduced current-only requirement mismatch; validating all historical bytes.'
    $historical=Test-NativePayloadManifest -PayloadRoot $resolved -IntegrityOnly
    if(-not$historical.Ready){throw "Real previous fixture failed byte-integrity validation: $($historical.Reasons -join '; ')"}
    Write-Host '[checkpoint] Previous release historical byte integrity passed; validating current candidate strictly.'
    $candidateStrict=Test-NativePayloadManifest -PayloadRoot $candidate
    if(-not$candidateStrict.Ready){throw "Current candidate failed strict validation: $($candidateStrict.Reasons -join '; ')"}
    Write-Host '[checkpoint] Current candidate strict validation passed.'
    [pscustomobject]@{
        passed=$true
        previous_version=$historical.Version
        previous_files_checked=$historical.FilesChecked
        reproduced_current_only_requirements=$strictReasons
        historical_integrity_ready=$historical.Ready
        candidate_version=$candidateStrict.Version
        candidate_files_checked=$candidateStrict.FilesChecked
        candidate_strict_ready=$candidateStrict.Ready
    }|ConvertTo-Json -Depth 5
}
finally{
    if(Test-Path -LiteralPath $current){
        $item=Get-Item -LiteralPath $current -Force
        if(($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0){throw'Refusing to clean a transition-test current path that is not a junction.'}
        [IO.Directory]::Delete([IO.Path]::GetFullPath($current),$false)
    }
    if(Test-Path -LiteralPath $temp){
        $full=[IO.Path]::GetFullPath($temp)
        $tempPrefix=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
        if(-not$full.StartsWith($tempPrefix,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-notmatch'^s-hospital-pre-db-transition-[0-9a-f]{32}$'){throw'Refusing unsafe transition-test cleanup path.'}
        Remove-Item -LiteralPath $full -Recurse -Force
    }
}
