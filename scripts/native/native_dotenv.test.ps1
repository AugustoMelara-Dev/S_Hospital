#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_dotenv.ps1')

$values = @(
    'C:\native\storage',
    'C:\path\native\café "quoted" $literal',
    "line one`nline two",
    'backslash-at-end\'
)
foreach ($value in $values) {
    $encoded = ConvertTo-NativeDotEnvValue $value
    $decoded = ConvertFrom-NativeDotEnvValue $encoded
    if ($decoded -cne $value) { throw "Dotenv round-trip failed for '$value': '$decoded'" }
}
Write-Host '[ OK ] Native dotenv codec contract passed.'
