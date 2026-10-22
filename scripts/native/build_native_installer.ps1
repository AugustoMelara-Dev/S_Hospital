#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PayloadRoot,
    [Parameter(Mandatory = $true)][string] $Version,
    [string] $IsccPath,
    [string] $DefinitionPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($DefinitionPath)) {
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $DefinitionPath = Join-Path $projectRoot 'installer\native\S_Hospital_Native.iss'
}
if ([string]::IsNullOrWhiteSpace($IsccPath)) {
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $candidates = @(@(
        (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
        (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
        (Join-Path $projectRoot 'artifacts\tool-cache\inno-6.5.4-portable\ISCC.exe')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) })
    if ($candidates.Count -gt 0) { $IsccPath = $candidates[0] }
}
if ([string]::IsNullOrWhiteSpace($IsccPath)) { throw 'Inno Setup compiler is unavailable. Run prepare_inno_compiler.ps1 into the workspace cache.' }
foreach ($file in @($IsccPath, $DefinitionPath, (Join-Path $PayloadRoot 'native-payload.manifest.json'))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Installer build input is missing: $file" }
}

. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
$validation = Test-NativePayloadManifest -PayloadRoot $PayloadRoot
if (-not $validation.Ready) { throw "Native payload is invalid: $($validation.Reasons -join '; ')" }

& $IsccPath "/DProductVersion=$Version" "/DPayloadRoot=$PayloadRoot" $DefinitionPath
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compiler failed with exit code $LASTEXITCODE." }
