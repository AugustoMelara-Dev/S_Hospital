#Requires -Version 5.1

Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'native_acl.ps1')
. (Join-Path $PSScriptRoot 'native_config.ps1')

$script:NativeElevatedPhpEnvironmentNames = @(
    'APP_CONFIG_CACHE','APP_EVENTS_CACHE','APP_PACKAGES_CACHE','APP_ROUTES_CACHE','APP_SERVICES_CACHE',
    'VIEW_COMPILED_PATH','PHPRC','PHP_INI_SCAN_DIR','HOSPITAL_NATIVE_DATA_ROOT','LARAVEL_STORAGE_PATH','HOSPITAL_DUMP_BINARY'
)

function New-NativeElevatedPhpContext {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Layout,
        [Parameter(Mandatory = $true)][string] $ReleaseRoot
    )

    $administratorRoot = Join-Path $Layout.ConfigRoot 'administrator-only'
    if (-not (Test-Path -LiteralPath $administratorRoot -PathType Container)) {
        New-Item -ItemType Directory -Path $administratorRoot | Out-Null
    }
    Set-NativeAclProfile -Path $administratorRoot -Profile AdministratorSecret
    $suffix = $PID.ToString() + '-' + [guid]::NewGuid().ToString('N')
    $cacheRoot = Join-Path $administratorRoot ('php-cache-' + $suffix)
    $scanRoot = Join-Path $administratorRoot 'php-scan-disabled'
    $phpIni = Join-Path $administratorRoot ('php-' + $suffix + '.ini')
    New-Item -ItemType Directory -Path $cacheRoot | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $cacheRoot 'views') | Out-Null
    if (-not (Test-Path -LiteralPath $scanRoot -PathType Container)) { New-Item -ItemType Directory -Path $scanRoot | Out-Null }
    Set-NativeAclProfile -Path $cacheRoot -Profile AdministratorSecret
    Set-NativeAclProfile -Path $scanRoot -Profile AdministratorSecret
    Write-NativePhpConfiguration -Layout $Layout -Path $phpIni -RuntimeRoot (Join-Path $ReleaseRoot 'runtime') | Out-Null
    Set-NativeAclProfile -Path $phpIni -Profile AdministratorSecret

    $saved = @{}
    foreach ($name in $script:NativeElevatedPhpEnvironmentNames) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    $overrides = @{
        APP_CONFIG_CACHE = (Join-Path $cacheRoot 'config.php')
        APP_EVENTS_CACHE = (Join-Path $cacheRoot 'events.php')
        APP_PACKAGES_CACHE = (Join-Path $cacheRoot 'packages.php')
        APP_ROUTES_CACHE = (Join-Path $cacheRoot 'routes.php')
        APP_SERVICES_CACHE = (Join-Path $cacheRoot 'services.php')
        VIEW_COMPILED_PATH = (Join-Path $cacheRoot 'views')
        PHPRC = ''
        PHP_INI_SCAN_DIR = $scanRoot
        HOSPITAL_NATIVE_DATA_ROOT = $Layout.DataRoot
        LARAVEL_STORAGE_PATH = $Layout.StorageRoot
        HOSPITAL_DUMP_BINARY = (Join-Path $ReleaseRoot 'runtime\mariadb\bin\mariadb-dump.exe')
    }
    foreach ($entry in $overrides.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable([string]$entry.Key, [string]$entry.Value, 'Process')
    }
    [pscustomobject]@{ PhpIniPath = $phpIni; CacheRoot = $cacheRoot; ScanRoot = $scanRoot; SavedEnvironment = $saved }
}

function Remove-NativeElevatedPhpContext {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)] $Context)
    foreach ($name in $script:NativeElevatedPhpEnvironmentNames) {
        [Environment]::SetEnvironmentVariable($name, $Context.SavedEnvironment[$name], 'Process')
    }
    foreach ($path in @($Context.CacheRoot, $Context.PhpIniPath)) {
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Recurse -Force }
    }
}
