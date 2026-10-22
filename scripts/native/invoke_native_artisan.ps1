#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet('migrate','migration-status','seed-initial','optimize','has-admin','backup-manual','verify-backup','verify-migration-backup')][string] $Action,
    [Parameter(Mandatory = $true)][string] $InstallRoot,
    [Parameter(Mandatory = $true)][string] $DataRoot,
    [string] $ReleaseRoot,
    [int] $BackupId,
    [switch] $WhatIfOnly,
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_dotenv.ps1')
. (Join-Path $PSScriptRoot 'lib\native_layout.ps1')
. (Join-Path $PSScriptRoot 'lib\native_elevated_php.ps1')

$current = if ([string]::IsNullOrWhiteSpace($ReleaseRoot)) { Join-Path $InstallRoot 'current' } else { $ReleaseRoot }
$backend = Join-Path $current 'app\backend'
$php = Join-Path $current 'runtime\php\php.exe'
$phpIni = Join-Path $DataRoot 'config\php.ini'
$envPath = Join-Path $DataRoot 'config\hospital.env'
$artisanArguments = switch ($Action) {
    'migrate' { @('artisan','migrate','--force','--no-interaction') }
    'migration-status' { @('artisan','migrate:status','--pending=2','--no-ansi','--no-interaction') }
    'seed-initial' { @('artisan','db:seed','--class=ProductionInstallationSeeder','--force','--no-interaction') }
    'optimize' { @('artisan','optimize','--no-interaction') }
    'has-admin' { @('artisan','auth:has-active-admin','--json') }
    'backup-manual' { @('artisan','hospital:backup','--type=manual','--json') }
    'verify-backup' {
        if ($BackupId -lt 1) { throw 'BackupId is required for exact backup verification.' }
        @('artisan','hospital:verify-backup',([string]$BackupId),'--json')
    }
    'verify-migration-backup' { @('artisan','hospital:verify-migration-backup','--json') }
}
$phpArguments = @('-c', $phpIni)
if (-not [string]::IsNullOrWhiteSpace($ReleaseRoot)) {
    $phpArguments += @('-d', ('extension_dir=' + (Join-Path $current 'runtime\php\ext')))
}
$command = [pscustomobject]@{
    Executable = $php
    Arguments = $phpArguments + $artisanArguments
    WorkingDirectory = $backend
    EnvironmentFile = $envPath
    Action = $Action
}
if ($WhatIfOnly) {
    if ($Json) { $command | ConvertTo-Json -Depth 4 } else { $command }
    exit 0
}

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) { throw "Runtime environment is missing: $envPath" }
$allowedEnvironmentNames = @(
    'APP_NAME','APP_ENV','APP_KEY','APP_DEBUG','APP_URL','LOG_CHANNEL','LOG_LEVEL',
    'DB_CONNECTION','DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_APP_ACCOUNT_HOST','DB_PASSWORD',
    'SESSION_DRIVER','SESSION_SECURE_COOKIE','SANCTUM_STATEFUL_DOMAINS','CACHE_STORE','QUEUE_CONNECTION',
    'BROADCAST_CONNECTION','FILESYSTEM_DISK','HOSPITAL_BACKUP_ENCRYPTION_KEY','HOSPITAL_ALLOW_INSECURE_HTTP',
    'HOSPITAL_NATIVE_DATA_ROOT','LARAVEL_STORAGE_PATH','APP_CONFIG_CACHE','APP_EVENTS_CACHE','APP_PACKAGES_CACHE',
    'APP_ROUTES_CACHE','APP_SERVICES_CACHE','VIEW_COMPILED_PATH','HOSPITAL_DUMP_BINARY'
)
$loadedEnvironment = @{}
foreach ($name in $allowedEnvironmentNames) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
foreach ($line in [IO.File]::ReadAllLines($envPath)) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) { throw 'Invalid runtime environment entry.' }
    $name = $trimmed.Substring(0, $separator).Trim()
    if ($name -notmatch '^[A-Z][A-Z0-9_]*$') { throw "Invalid runtime environment key: $name" }
    if ($allowedEnvironmentNames -notcontains $name) { throw "Runtime environment key is not allowed for elevated maintenance: $name" }
    $value = ConvertFrom-NativeDotEnvValue $trimmed.Substring($separator + 1).Trim()
    $loadedEnvironment[$name] = $value
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}
$requiredEnvironment = @('APP_KEY','APP_ENV','APP_DEBUG','APP_URL','DB_CONNECTION','DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_APP_ACCOUNT_HOST','DB_PASSWORD','HOSPITAL_BACKUP_ENCRYPTION_KEY')
foreach ($name in $requiredEnvironment) {
    if (-not $loadedEnvironment.ContainsKey($name) -or [string]::IsNullOrWhiteSpace([string]$loadedEnvironment[$name])) {
        throw "Required elevated maintenance setting is missing: $name"
    }
}
if ($loadedEnvironment.APP_ENV -ne 'production' -or $loadedEnvironment.APP_DEBUG -ne 'false') { throw 'Elevated maintenance requires production mode with debug disabled.' }
if ($loadedEnvironment.DB_CONNECTION -ne 'mysql' -or $loadedEnvironment.DB_HOST -ne '127.0.0.1' -or $loadedEnvironment.DB_APP_ACCOUNT_HOST -ne '127.0.0.1') {
    throw 'Elevated maintenance database endpoints must remain local MySQL.'
}
$databasePort = 0
if (-not [int]::TryParse([string]$loadedEnvironment.DB_PORT, [ref]$databasePort) -or $databasePort -lt 1024 -or $databasePort -gt 65535) { throw 'Elevated maintenance database port is invalid.' }
if ($loadedEnvironment.DB_DATABASE -notmatch '^[A-Za-z0-9_]+$' -or $loadedEnvironment.DB_USERNAME -notmatch '^[A-Za-z0-9_]+$') { throw 'Elevated maintenance database identity is invalid.' }
$appUri = $null
if (-not [uri]::TryCreate([string]$loadedEnvironment.APP_URL, [UriKind]::Absolute, [ref]$appUri) -or $appUri.Scheme -ne 'http' -or $appUri.Host -ne '127.0.0.1') {
    throw 'Elevated maintenance APP_URL must remain on loopback HTTP.'
}

$releaseMetadata = Get-Content -LiteralPath (Join-Path $current 'native-release.json') -Raw | ConvertFrom-Json
$layout = Get-NativeInstallLayout -InstallRoot $InstallRoot -DataRoot $DataRoot -Version ([string]$releaseMetadata.version)
$elevatedPhp = New-NativeElevatedPhpContext -Layout $layout -ReleaseRoot $current
$actualPhpArguments = @('-c', $elevatedPhp.PhpIniPath) + $artisanArguments

Push-Location $backend
try {
    & $php @($actualPhpArguments)
    $artisanExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
    Remove-NativeElevatedPhpContext -Context $elevatedPhp
}
exit $artisanExitCode
