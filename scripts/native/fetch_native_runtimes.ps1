#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $CacheRoot,
    [string] $SourcesPath,
    [switch] $WhatIfOnly,
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'

if ([string]::IsNullOrWhiteSpace($SourcesPath)) {
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $SourcesPath = Join-Path $projectRoot 'installer\native\runtime-sources.json'
}

if (-not (Test-Path -LiteralPath $SourcesPath -PathType Leaf)) { throw "Runtime sources manifest is missing: $SourcesPath" }
$sources = Get-Content -LiteralPath $SourcesPath -Raw | ConvertFrom-Json
if ($sources.schema_version -ne 1 -or $sources.architecture -ne 'x64') { throw 'Runtime sources manifest identity is invalid.' }

$plan = @($sources.artifacts | ForEach-Object {
    [pscustomobject]@{
        Id = [string]$_.id
        Version = [string]$_.version
        Uri = [string]$_.url
        Destination = Join-Path $CacheRoot ([string]$_.file)
        Algorithm = [string]$_.algorithm
        ExpectedHash = [string]$_.hash
        ChecksumSource = [string]$_.checksum_source
    }
})

if ($WhatIfOnly) {
    if ($Json) { $plan | ConvertTo-Json -Depth 4 }
    else { $plan }
    exit 0
}

New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null
$results = @()
foreach ($artifact in $plan) {
    if ($artifact.Uri -notmatch '^https://') { throw "Runtime '$($artifact.Id)' must use HTTPS." }
    $destination = $artifact.Destination
    $downloaded = $false
    if (Test-Path -LiteralPath $destination -PathType Leaf) {
        $actual = (Get-FileHash -LiteralPath $destination -Algorithm $artifact.Algorithm).Hash.ToLowerInvariant()
        if ($actual -ne $artifact.ExpectedHash) { Remove-Item -LiteralPath $destination -Force }
    }
    if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
        $partial = $destination + '.partial'
        try {
            Invoke-WebRequest -Uri $artifact.Uri -OutFile $partial -UseBasicParsing
            $actual = (Get-FileHash -LiteralPath $partial -Algorithm $artifact.Algorithm).Hash.ToLowerInvariant()
            if ($actual -ne $artifact.ExpectedHash) { throw "Checksum mismatch for runtime '$($artifact.Id)'." }
            Move-Item -LiteralPath $partial -Destination $destination -Force
            $downloaded = $true
        }
        finally {
            if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force }
        }
    }
    $results += [pscustomobject]@{
        Id = $artifact.Id
        Version = $artifact.Version
        Path = $destination
        HashVerified = $true
        Downloaded = $downloaded
    }
}

if ($Json) { $results | ConvertTo-Json -Depth 4 }
else { $results }
