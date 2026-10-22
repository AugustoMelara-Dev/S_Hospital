#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$sourcePath = Join-Path $PSScriptRoot 'verify_native_host.ps1'
$source = Get-Content -LiteralPath $sourcePath -Raw
$tokens = $null
$errors = $null
[void][Management.Automation.Language.Parser]::ParseFile($sourcePath, [ref]$tokens, [ref]$errors)
if (@($errors).Count -ne 0) { throw ('Host verifier has parse errors: ' + (@($errors.Message) -join '; ')) }

$required = @(
    'CaptureXamppBaseline',
    'ExpectedExeSha256',
    'XamppBaselinePath',
    'Get-CimInstance Win32_Service',
    'NT AUTHORITY\LocalService',
    'DelayedAutoStart',
    'Get-NetTCPConnection',
    '127.0.0.1',
    'native-install-state.json',
    'Get-ManifestIdentity',
    'files_checked',
    'WScript.Shell',
    'Get-NetFirewallRule',
    'canonical protected S_Hospital roots',
    'http.health_and_static_assets',
    'Initial administrator creation and credentials are not read or claimed',
    'Backup integrity and recovery require their authenticated or elevated verification phase'
)
foreach ($needle in $required) {
    if (-not $source.Contains($needle)) { throw "Host verifier contract is missing: $needle" }
}
if ($source -match '(?i)DB_PASSWORD|APP_KEY|BACKUP_ENCRYPTION_KEY|password\s*=') {
    throw 'Host verifier must not read or emit application secrets.'
}

Write-Output 'PASS native host verifier contract (read-only inventory, fail-closed checks, explicit unobserved scope).'
