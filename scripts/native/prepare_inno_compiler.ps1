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
    $SourcesPath = Join-Path $projectRoot 'installer\native\tool-sources.json'
}
$source = @((Get-Content -LiteralPath $SourcesPath -Raw | ConvertFrom-Json).tools | Where-Object id -eq 'inno-setup')
if ($source.Count -ne 1) { throw 'Pinned Inno Setup source is missing or ambiguous.' }
$definition = $source[0]
$installer = Join-Path $CacheRoot ([string]$definition.file)
$portableRoot = Join-Path $CacheRoot ('inno-' + [string]$definition.version + '-portable')
$iscc = Join-Path $portableRoot 'ISCC.exe'
$plan = [pscustomobject]@{ Version = $definition.version; Uri = $definition.url; Installer = $installer; PortableRoot = $portableRoot; Compiler = $iscc }
if ($WhatIfOnly) { if ($Json) { $plan | ConvertTo-Json -Depth 3 } else { $plan }; exit 0 }

New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $installer -PathType Leaf) -or (Get-FileHash -LiteralPath $installer -Algorithm $definition.algorithm).Hash.ToLowerInvariant() -ne $definition.hash) {
    $partial = $installer + '.partial'
    try {
        Invoke-WebRequest -Uri $definition.url -OutFile $partial -UseBasicParsing
        if ((Get-FileHash -LiteralPath $partial -Algorithm $definition.algorithm).Hash.ToLowerInvariant() -ne $definition.hash) { throw 'Inno Setup compiler installer hash mismatch.' }
        Move-Item -LiteralPath $partial -Destination $installer -Force
    }
    finally { if (Test-Path -LiteralPath $partial) { Remove-Item -LiteralPath $partial -Force } }
}
$signature = Get-AuthenticodeSignature -LiteralPath $installer
if ($signature.Status -ne [Management.Automation.SignatureStatus]::Valid -or $signature.SignerCertificate.Subject -notmatch [regex]::Escape([string]$definition.signer)) {
    throw 'Inno Setup compiler installer signature is not the pinned publisher.'
}
if (-not (Test-Path -LiteralPath $iscc -PathType Leaf)) {
    $process = Start-Process -FilePath $installer -ArgumentList @('/portable=1','/verysilent','/currentuser',('/dir="' + $portableRoot + '"'),'/noicons','/norestart','/suppressmsgboxes') -Wait -PassThru
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $iscc -PathType Leaf)) { throw "Portable Inno Setup extraction failed with code $($process.ExitCode)." }
}
$result = [pscustomobject]@{ Ready = $true; Version = $definition.version; Compiler = $iscc; InstallerHashVerified = $true; SignatureVerified = $true }
if ($Json) { $result | ConvertTo-Json -Depth 3 } else { $result }
