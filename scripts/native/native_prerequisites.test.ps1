#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$module = Join-Path $PSScriptRoot 'lib\native_prerequisites.ps1'
$sources = Get-Content -LiteralPath (Join-Path $projectRoot 'installer\native\runtime-sources.json') -Raw | ConvertFrom-Json
$definition = @($sources.artifacts | Where-Object id -eq 'vcredist')
if ($definition.Count -ne 1) { throw 'Exactly one Visual C++ Redistributable artifact is required.' }
if ([version]$definition[0].version -lt [version]'14.0') { throw 'Visual C++ Redistributable version is invalid.' }
if ($definition[0].url -notmatch '^https://aka\.ms/vs/[0-9]+/release/[0-9.]+/VC_redist\.x64\.exe$') { throw 'Visual C++ Redistributable must use a versioned Microsoft URL.' }

$source = Get-Content -LiteralPath $module -Raw
foreach ($contract in @('Get-AuthenticodeSignature','O=Microsoft Corporation','/install','/quiet','/norestart','1638','3010','sodium_crypto_pwhash','mariadbd\.exe','mariadb\.exe','Invoke-NativePhpCodeFromStandardInput','RedirectStandardInput','PHP CLI on Windows reads standard input')) {
    if ($source -notmatch $contract) { throw "Native prerequisite contract is missing: $contract" }
}
if ($source -match '\s-r\s+\$probeCode') { throw 'PHP probe code must not travel through the Windows command line.' }

. $module
$canaryPassword='canary-password-do-not-log'
$canaryToken='canary-token-do-not-log'
$canaryAppKey='canary-app-key-do-not-log'
$sensitiveFailure=ConvertTo-NativeSafeInstallFailureMessage -Phase 'secure_database' -Message "password=$canaryPassword token=$canaryToken APP_KEY=$canaryAppKey"
if($sensitiveFailure-match[regex]::Escape($canaryPassword)-or$sensitiveFailure-match[regex]::Escape($canaryToken)-or$sensitiveFailure-match[regex]::Escape($canaryAppKey)){throw'Sensitive failure diagnostics exposed a canary secret.'}
$earlyFailure=ConvertTo-NativeSafeInstallFailureMessage -Phase 'validate_prior_release_integrity' -Message "required file missing; password=$canaryPassword"
if($earlyFailure-notmatch'required file missing'-or$earlyFailure-match[regex]::Escape($canaryPassword)){throw'Early failure diagnostics did not preserve safe detail or redact a canary.'}

$cached = Join-Path $projectRoot ('artifacts\native-cache\' + $definition[0].file)
if (Test-Path -LiteralPath $cached -PathType Leaf) {
    $hash = (Get-FileHash -LiteralPath $cached -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $definition[0].hash) { throw 'Cached Visual C++ Redistributable hash does not match the pinned source.' }
    $signature = Get-AuthenticodeSignature -LiteralPath $cached
    if ($signature.Status -ne [Management.Automation.SignatureStatus]::Valid -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
        throw 'Cached Visual C++ Redistributable signature is not valid Microsoft code signing.'
    }
}

Write-Host '[ OK ] Native prerequisites contract passed.'
