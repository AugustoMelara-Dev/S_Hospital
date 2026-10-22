#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('php-fastcgi', 'web', 'queue-default', 'queue-backups', 'scheduler')]
    [string] $Role,
    [Parameter(Mandatory = $true)][string] $InstallRoot,
    [Parameter(Mandatory = $true)][string] $DataRoot,
    [string] $PhpEndpoint = '127.0.0.1:9070',
    [string] $EnvironmentVariable,
    [string] $Value,
    [switch] $WhatIfOnly,
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_dotenv.ps1')

function Import-NativeEnvironment {
    param([Parameter(Mandatory = $true)][string] $Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Runtime environment is missing: $Path" }
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -lt 1) { throw "Invalid runtime environment entry in $Path" }
        $name = $trimmed.Substring(0, $separator).Trim()
        if ($name -notmatch '^[A-Z][A-Z0-9_]*$') { throw "Invalid runtime environment key: $name" }
        $entryValue = $trimmed.Substring($separator + 1).Trim()
        if ($entryValue.Length -ge 2 -and $entryValue[0] -eq '"' -and $entryValue[$entryValue.Length - 1] -eq '"') {
            $entryValue = ConvertFrom-NativeDotEnvValue $entryValue
        }
        [Environment]::SetEnvironmentVariable($name, $entryValue, 'Process')
    }
}

$currentRoot = Join-Path $InstallRoot 'current'
$backendRoot = Join-Path $currentRoot 'app\backend'
$phpRoot = Join-Path $currentRoot 'runtime\php'
$configRoot = Join-Path $DataRoot 'config'
$php = Join-Path $phpRoot 'php.exe'
$command = switch ($Role) {
    'php-fastcgi' {
        [pscustomobject]@{
            Executable = Join-Path $phpRoot 'php-cgi.exe'
            Arguments = @('-c', (Join-Path $configRoot 'php.ini'), '-b', $PhpEndpoint)
            WorkingDirectory = $backendRoot
        }
    }
    'web' {
        [pscustomobject]@{
            Executable = Join-Path $currentRoot 'runtime\caddy\caddy.exe'
            Arguments = @('run', '--config', (Join-Path $configRoot 'Caddyfile'), '--adapter', 'caddyfile')
            WorkingDirectory = $backendRoot
        }
    }
    'queue-default' {
        [pscustomobject]@{
            Executable = $php
            Arguments = @('-c', (Join-Path $configRoot 'php.ini'), 'artisan', 'queue:work', 'database', '--queue=default', '--sleep=2', '--tries=3', '--timeout=120', '--no-interaction')
            WorkingDirectory = $backendRoot
        }
    }
    'queue-backups' {
        [pscustomobject]@{
            Executable = $php
            Arguments = @('-c', (Join-Path $configRoot 'php.ini'), 'artisan', 'queue:work', 'database', '--queue=backups', '--sleep=5', '--tries=1', '--timeout=3600', '--no-interaction')
            WorkingDirectory = $backendRoot
        }
    }
    'scheduler' {
        [pscustomobject]@{
            Executable = $php
            Arguments = @('-c', (Join-Path $configRoot 'php.ini'), 'artisan', 'schedule:work', '--no-interaction')
            WorkingDirectory = $backendRoot
        }
    }
}

if ($WhatIfOnly) {
    if ($Json) { $command | ConvertTo-Json -Depth 4 }
    else { $command }
    exit 0
}

Import-NativeEnvironment -Path (Join-Path $configRoot 'hospital.env')
$phpIni = Join-Path $configRoot 'php.ini'
$phpScanRoot = Join-Path $configRoot 'php-scan-disabled'
if (-not (Test-Path -LiteralPath $phpScanRoot -PathType Container)) { throw "Controlled PHP scan directory is missing: $phpScanRoot" }
# Laravel's scheduler creates `schedule:run` as a child PHP process without
# forwarding the parent's `-c` argument. Keep every PHP child on the bundled,
# immutable configuration and prevent user or machine-wide ini scanning.
[Environment]::SetEnvironmentVariable('PHPRC', $phpIni, 'Process')
[Environment]::SetEnvironmentVariable('PHP_INI_SCAN_DIR', $phpScanRoot, 'Process')
if ($EnvironmentVariable) {
    if ($EnvironmentVariable -notmatch '^[A-Z][A-Z0-9_]*$') { throw 'Invalid process environment variable name.' }
    [Environment]::SetEnvironmentVariable($EnvironmentVariable, $Value, 'Process')
}

if (-not (Test-Path -LiteralPath $command.Executable -PathType Leaf)) { throw "Service executable is missing: $($command.Executable)" }
if (-not (Test-Path -LiteralPath $command.WorkingDirectory -PathType Container)) { throw "Application directory is missing: $($command.WorkingDirectory)" }

Push-Location $command.WorkingDirectory
try {
    & $command.Executable @($command.Arguments)
    if ($LASTEXITCODE -ne 0) { throw "Native service role '$Role' exited with code $LASTEXITCODE." }
}
finally {
    Pop-Location
}
