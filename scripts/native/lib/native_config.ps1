#Requires -Version 5.1

Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'native_dotenv.ps1')

function ConvertTo-NativeXmlText {
    param([AllowEmptyString()][string] $Value)

    [Security.SecurityElement]::Escape($Value)
}

function ConvertTo-NativeConfigPath {
    param([Parameter(Mandatory = $true)][string] $Path)

    $Path -replace '\\', '/'
}

function Write-NativeConfigFile {
    param([Parameter(Mandatory = $true)][string] $Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string] $Content)
    $temporary = $Path + '.tmp-' + [guid]::NewGuid().ToString('N')
    try {
        [IO.File]::WriteAllText($temporary, $Content, [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $Path -Force
    }
    finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
}

function Write-NativePhpConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Layout,
        [string] $Path,
        [string] $RuntimeRoot
    )

    $phpIniPath = if ([string]::IsNullOrWhiteSpace($Path)) { Join-Path $Layout.ConfigRoot 'php.ini' } else { $Path }
    $selectedRuntime = if ([string]::IsNullOrWhiteSpace($RuntimeRoot)) { Join-Path $Layout.CurrentPath 'runtime' } else { $RuntimeRoot }
    $extensionRoot = ConvertTo-NativeConfigPath (Join-Path $selectedRuntime 'php\ext')
    $phpSessionDirectory = Join-Path $Layout.StateRoot 'sessions'
    $phpSessionRoot = ConvertTo-NativeConfigPath $phpSessionDirectory
    New-Item -ItemType Directory -Path $phpSessionDirectory -Force | Out-Null
    $phpIni = @"
[PHP]
expose_php=Off
display_errors=Off
log_errors=On
error_log="$(ConvertTo-NativeConfigPath (Join-Path $Layout.LogRoot 'php-error.log'))"
memory_limit=256M
upload_max_filesize=20M
post_max_size=24M
date.timezone=America/Tegucigalpa
extension_dir="$extensionRoot"
session.save_path="$phpSessionRoot"
extension=curl
extension=fileinfo
extension=gd
extension=intl
extension=mbstring
extension=openssl
extension=pdo_mysql
extension=sodium
extension=zip
zend_extension=opcache
opcache.enable=1
opcache.validate_timestamps=0
"@
    Write-NativeConfigFile -Path $phpIniPath -Content $phpIni
    $phpIniPath
}

function New-NativeRuntimeConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Plan,
        [Parameter(Mandatory = $true)] $Secrets
    )

    $layout = $Plan.Layout
    foreach ($directory in @($layout.ConfigRoot, $layout.DatabaseData, $layout.StorageRoot, $layout.CacheRoot, $layout.BackupRoot, $layout.LogRoot, $layout.StateRoot, $layout.ServiceRoot)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    # Empty, protected scan root used by runtime PHP and its child processes.
    New-Item -ItemType Directory -Path (Join-Path $layout.ConfigRoot 'php-scan-disabled') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $layout.CacheRoot 'views') -Force | Out-Null
    foreach ($storageDirectory in @('app','app\private','app\public','framework','framework\cache','framework\cache\data','framework\sessions','framework\testing','framework\views','logs')) {
        New-Item -ItemType Directory -Path (Join-Path $layout.StorageRoot $storageDirectory) -Force | Out-Null
    }

    $databasePort = ([uri]('tcp://' + $Plan.Network.DatabaseEndpoint)).Port
    $appUri = [uri]$Plan.Network.AppUrl
    $currentBackend = Join-Path $layout.CurrentPath 'app\backend'
    $currentRuntime = Join-Path $layout.CurrentPath 'runtime'

    $envPath = Join-Path $layout.ConfigRoot 'hospital.env'
    $envLines = @(
        'APP_NAME=S_Hospital'
        'APP_ENV=production'
        ("APP_KEY={0}" -f (ConvertTo-NativeDotEnvValue $Secrets.AppKey))
        'APP_DEBUG=false'
        ("APP_URL={0}" -f $Plan.Network.AppUrl)
        'LOG_CHANNEL=stack'
        'LOG_LEVEL=warning'
        'DB_CONNECTION=mysql'
        'DB_HOST=127.0.0.1'
        ("DB_PORT={0}" -f $databasePort)
        'DB_DATABASE=hospital_billing'
        'DB_USERNAME=hospital'
        'DB_APP_ACCOUNT_HOST=127.0.0.1'
        ("DB_PASSWORD={0}" -f (ConvertTo-NativeDotEnvValue $Secrets.DatabasePassword))
        'SESSION_DRIVER=file'
        'SESSION_SECURE_COOKIE=false'
        ("SANCTUM_STATEFUL_DOMAINS={0}" -f $appUri.Authority)
        'CACHE_STORE=database'
        'QUEUE_CONNECTION=database'
        'BROADCAST_CONNECTION=null'
        'FILESYSTEM_DISK=local'
        ("HOSPITAL_BACKUP_ENCRYPTION_KEY={0}" -f (ConvertTo-NativeDotEnvValue $Secrets.BackupEncryptionKey))
        'HOSPITAL_ALLOW_INSECURE_HTTP=1'
        ("HOSPITAL_NATIVE_DATA_ROOT={0}" -f (ConvertTo-NativeDotEnvValue $layout.DataRoot))
        ("LARAVEL_STORAGE_PATH={0}" -f (ConvertTo-NativeDotEnvValue $layout.StorageRoot))
        ("APP_CONFIG_CACHE={0}" -f (ConvertTo-NativeDotEnvValue (Join-Path $layout.CacheRoot 'config.php')))
        ("APP_EVENTS_CACHE={0}" -f (ConvertTo-NativeDotEnvValue (Join-Path $layout.CacheRoot 'events.php')))
        ("APP_PACKAGES_CACHE={0}" -f (ConvertTo-NativeDotEnvValue (Join-Path $layout.CacheRoot 'packages.php')))
        ("APP_ROUTES_CACHE={0}" -f (ConvertTo-NativeDotEnvValue (Join-Path $layout.CacheRoot 'routes.php')))
        ("APP_SERVICES_CACHE={0}" -f (ConvertTo-NativeDotEnvValue (Join-Path $layout.CacheRoot 'services.php')))
        ("VIEW_COMPILED_PATH={0}" -f (ConvertTo-NativeDotEnvValue (Join-Path $layout.CacheRoot 'views')))
        ("HOSPITAL_DUMP_BINARY={0}" -f (ConvertTo-NativeDotEnvValue (Join-Path $currentRuntime 'mariadb\bin\mariadb-dump.exe')))
    )
    Write-NativeConfigFile -Path $envPath -Content (($envLines -join "`r`n") + "`r`n")

    $caddyfilePath = Join-Path $layout.ConfigRoot 'Caddyfile'
    $publicRoot = ConvertTo-NativeConfigPath (Join-Path $currentBackend 'public')
    $httpListenAddress = if ($Plan.Network.ListenAddress -match '^https?://') { $Plan.Network.ListenAddress } else { 'http://' + $Plan.Network.ListenAddress }
    $caddy = @"
{
    auto_https off
    admin off
}

$httpListenAddress {
    root * "$publicRoot"
    encode zstd gzip
    php_fastcgi $($Plan.Network.PhpEndpoint) {
        try_files {path} /index.php
    }
    file_server
}
"@
    Write-NativeConfigFile -Path $caddyfilePath -Content $caddy

    $phpIniPath = Write-NativePhpConfiguration -Layout $layout

    $mariaConfigPath = Join-Path $layout.ConfigRoot 'my.ini'
    $databaseData = ConvertTo-NativeConfigPath $layout.DatabaseData
    $mariaLog = ConvertTo-NativeConfigPath (Join-Path $layout.LogRoot 'mariadb-error.log')
    $maria = @"
[client]
host=127.0.0.1
port=$databasePort
default-character-set=utf8mb4

[mysqld]
basedir="$(ConvertTo-NativeConfigPath (Join-Path $currentRuntime 'mariadb'))"
datadir="$databaseData"
bind-address=127.0.0.1
port=$databasePort
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
sql-mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
log-error="$mariaLog"
skip-name-resolve
"@
    Write-NativeConfigFile -Path $mariaConfigPath -Content $maria

    $runner = Join-Path $layout.CurrentPath 'scripts\native\run_native_service.ps1'
    $wrapperSource = Join-Path $layout.ReleaseRoot 'runtime\winsw\WinSW-x64.exe'
    if (-not (Test-Path -LiteralPath $wrapperSource -PathType Leaf)) { throw 'Bundled WinSW service wrapper is missing from the validated release.' }
    $serviceConfigs = @()
    foreach ($service in @($Plan.Services | Where-Object Role -ne 'database')) {
        $serviceDirectory = Join-Path $layout.ServiceRoot $service.Id
        New-Item -ItemType Directory -Path $serviceDirectory -Force | Out-Null
        $serviceConfigPath = Join-Path $serviceDirectory ($service.Id + '.xml')
        $serviceExecutablePath = Join-Path $serviceDirectory ($service.Id + '.exe')
        if (Test-Path -LiteralPath $serviceExecutablePath -PathType Leaf) {
            $sourceHash=(Get-FileHash -LiteralPath $wrapperSource -Algorithm SHA256).Hash
            $installedHash=(Get-FileHash -LiteralPath $serviceExecutablePath -Algorithm SHA256).Hash
            if(-not$sourceHash.Equals($installedHash,[StringComparison]::OrdinalIgnoreCase)){
                throw "Service wrapper '$($service.Id)' differs from the validated runtime; use the update workflow."
            }
        }
        else {
            Copy-Item -LiteralPath $wrapperSource -Destination $serviceExecutablePath
        }
        $dependencies = @($service.DependsOn | ForEach-Object { '  <depend>' + (ConvertTo-NativeXmlText $_) + '</depend>' }) -join "`r`n"
        $roleArguments = if ($service.Role -eq 'php-fastcgi') {
            ' -EnvironmentVariable &quot;PHP_FCGI_MAX_REQUESTS&quot; -Value &quot;0&quot;'
        } else {
            ''
        }
        # WinSW 2.12.0 XML uses separate domain/user elements. The newer
        # <username> form is ignored by this bundled version and silently falls
        # back to LocalSystem.
        $accountParts=@([string]$service.Account -split '\\',2)
        if($accountParts.Count-ne2-or[string]::IsNullOrWhiteSpace($accountParts[0])-or[string]::IsNullOrWhiteSpace($accountParts[1])){
            throw "Invalid WinSW 2.x service account: $($service.Account)"
        }
        $serviceAccount = '  <serviceaccount>' + "`r`n" +
            '    <domain>' + (ConvertTo-NativeXmlText $accountParts[0]) + '</domain>' + "`r`n" +
            '    <user>' + (ConvertTo-NativeXmlText $accountParts[1]) + '</user>' + "`r`n" +
            '  </serviceaccount>'
        $xml = @"
<service>
  <id>$(ConvertTo-NativeXmlText $service.Id)</id>
  <name>$(ConvertTo-NativeXmlText $service.DisplayName)</name>
  <description>Servicio local de S_Hospital. No requiere acceso a Internet.</description>
  <executable>powershell.exe</executable>
  <arguments>-NoProfile -ExecutionPolicy Bypass -File &quot;$(ConvertTo-NativeXmlText $runner)&quot; -Role $(ConvertTo-NativeXmlText $service.Role) -InstallRoot &quot;$(ConvertTo-NativeXmlText $layout.InstallRoot)&quot; -DataRoot &quot;$(ConvertTo-NativeXmlText $layout.DataRoot)&quot; -PhpEndpoint &quot;$(ConvertTo-NativeXmlText $Plan.Network.PhpEndpoint)&quot;$roleArguments</arguments>
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
$serviceAccount
$dependencies
  <logpath>$(ConvertTo-NativeXmlText $layout.LogRoot)</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>8</keepFiles>
  </log>
  <onfailure action="restart" delay="5 sec" />
  <onfailure action="restart" delay="15 sec" />
  <resetfailure>1 hour</resetfailure>
</service>
"@
        Write-NativeConfigFile -Path $serviceConfigPath -Content $xml
        $serviceConfigs += [pscustomobject]@{ Id = $service.Id; Path = $serviceConfigPath; ExecutablePath = $serviceExecutablePath }
    }

    [pscustomobject]@{
        EnvPath = $envPath
        CaddyfilePath = $caddyfilePath
        PhpIniPath = $phpIniPath
        MariaConfigPath = $mariaConfigPath
        ServiceConfigs = $serviceConfigs
    }
}
