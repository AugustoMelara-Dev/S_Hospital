#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$layoutModule = Join-Path $PSScriptRoot 'lib\native_layout.ps1'
$planModule = Join-Path $PSScriptRoot 'lib\native_install_plan.ps1'
$configModule = Join-Path $PSScriptRoot 'lib\native_config.ps1'
if (-not (Test-Path -LiteralPath $configModule -PathType Leaf)) { throw "Missing native config module: $configModule" }
. $layoutModule
. $planModule
. $configModule

$root = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-native-config-' + [guid]::NewGuid().ToString('N'))
try {
    $layout = Get-NativeInstallLayout -InstallRoot (Join-Path $root 'program') -DataRoot (Join-Path $root 'data') -Version '2026.09.28'
    $wrapperSource=Join-Path $layout.ReleaseRoot 'runtime\winsw\WinSW-x64.exe'
    New-Item -ItemType Directory -Path (Split-Path $wrapperSource -Parent) -Force|Out-Null
    Set-Content -LiteralPath $wrapperSource -Value 'winsw-fixture' -Encoding ASCII
    $plan = Get-NativeInstallPlan -Layout $layout -PayloadRoot (Join-Path $root 'payload')
    $secrets = [pscustomobject]@{
        AppKey = 'base64:TEST_APP_KEY'
        DatabaseRootPassword = 'TEST_ROOT_PASSWORD'
        DatabasePassword = 'TEST_DB_PASSWORD'
        BackupEncryptionKey = 'TEST_BACKUP_KEY'
    }
    $result = New-NativeRuntimeConfiguration -Plan $plan -Secrets $secrets

    foreach ($path in @($result.EnvPath, $result.CaddyfilePath, $result.PhpIniPath, $result.MariaConfigPath)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing generated configuration: $path" }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $layout.ConfigRoot 'php-scan-disabled') -PathType Container)) { throw 'Controlled PHP scan directory was not created.' }
    $envText = Get-Content -LiteralPath $result.EnvPath -Raw
    if ($envText -notmatch 'BROADCAST_CONNECTION=null') { throw 'Single-PC config must disable external realtime.' }
    if ($envText -notmatch 'APP_DEBUG=false') { throw 'Production debug must be disabled.' }
    if ($envText -notmatch 'DB_HOST=127\.0\.0\.1') { throw 'Database must use loopback.' }
    if ($envText -notmatch 'DB_APP_ACCOUNT_HOST=127\.0\.0\.1') { throw 'Database grant host must be explicit for recovery.' }
    if ($envText -notmatch 'SESSION_DRIVER=file') { throw 'Session authentication configuration is missing.' }
    if ($envText -notmatch 'LARAVEL_STORAGE_PATH=') { throw 'Writable Laravel storage must live outside Program Files.' }
    if ($envText -notmatch 'APP_CONFIG_CACHE=') { throw 'Writable Laravel caches must live outside Program Files.' }
    if ($envText -notmatch 'HOSPITAL_DUMP_BINARY=.+mariadb-dump\.exe') { throw 'Backup dump binary must use the bundled MariaDB runtime.' }
    if ($envText -match 'AUTOMATIC_LOGIN|AUTH_BYPASS') { throw 'Configuration must not bypass login.' }

    $caddy = Get-Content -LiteralPath $result.CaddyfilePath -Raw
    if ($caddy -notmatch 'http://127\.0\.0\.1:8000') { throw 'Caddy must bind explicitly to loopback HTTP.' }
    if ($caddy -notmatch 'auto_https off') { throw 'Loopback-only Caddy must not attempt automatic HTTPS.' }
    if ($caddy -notmatch 'php_fastcgi 127\.0\.0\.1:9070') { throw 'Caddy FastCGI endpoint is wrong.' }
    if ($caddy -notmatch 'try_files \{path\} /index\.php') { throw 'Caddy must route Laravel API and SPA requests through the front controller.' }
    if ($caddy -notmatch 'file_server') { throw 'Caddy must serve built frontend assets.' }

    $maria = Get-Content -LiteralPath $result.MariaConfigPath -Raw
    if ($maria -notmatch 'bind-address=127\.0\.0\.1') { throw 'MariaDB must bind only to loopback.' }
    if ($maria -notmatch 'datadir=.+program-files' -and $maria -match 'datadir=.+program') { throw 'MariaDB data leaked into Program Files.' }

    if (@($result.ServiceConfigs).Count -ne 5) { throw 'Expected five WinSW service configs besides MariaDB.' }
    foreach($serviceConfig in @($result.ServiceConfigs)){
        if(-not(Test-Path -LiteralPath $serviceConfig.ExecutablePath -PathType Leaf)){throw "Missing persistent wrapper for $($serviceConfig.Id)."}
        if([IO.Path]::GetFileNameWithoutExtension($serviceConfig.ExecutablePath)-ne[IO.Path]::GetFileNameWithoutExtension($serviceConfig.Path)){throw 'WinSW executable and XML base names must match.'}
        if((Get-FileHash -LiteralPath $serviceConfig.ExecutablePath -Algorithm SHA256).Hash-ne(Get-FileHash -LiteralPath $wrapperSource -Algorithm SHA256).Hash){throw 'Persistent service wrapper differs from the validated bundled executable.'}
    }
    $webXml = Get-Content -LiteralPath ($result.ServiceConfigs | Where-Object Id -eq 'SHospitalWeb').Path -Raw
    if ($webXml -notmatch '<depend>SHospitalPhp</depend>') { throw 'Web service dependency is missing.' }
    if ($webXml -notmatch '<startmode>Automatic</startmode>') { throw 'Services must start automatically.' }
    if ($webXml -notmatch '<domain>NT AUTHORITY</domain>[\s\S]+<user>LocalService</user>') { throw 'Web service must use the WinSW 2.x LocalService account schema.' }
    if ($webXml -match '<username>|<user>LocalSystem</user>') { throw 'Application services must not use an unsupported account element or run as LocalSystem.' }
    foreach($serviceConfig in @($result.ServiceConfigs)){
        [xml]$serviceXml=Get-Content -LiteralPath $serviceConfig.Path -Raw
        if([string]$serviceXml.service.serviceaccount.domain-ne'NT AUTHORITY'-or[string]$serviceXml.service.serviceaccount.user-ne'LocalService'){
            throw "Service $($serviceConfig.Id) did not generate the WinSW 2.12 LocalService schema."
        }
        if($serviceXml.service.serviceaccount.PSObject.Properties.Name-contains'username'){throw "Service $($serviceConfig.Id) generated an unsupported WinSW 2.12 username element."}
    }
    $phpXml = Get-Content -LiteralPath ($result.ServiceConfigs | Where-Object Id -eq 'SHospitalPhp').Path -Raw
    if ($phpXml -notmatch 'PHP_FCGI_MAX_REQUESTS&quot; -Value &quot;0') { throw 'PHP FastCGI must not exit after a request limit.' }
    $phpIni = Get-Content -LiteralPath $result.PhpIniPath -Raw
    foreach ($extension in @('openssl','pdo_mysql','gd','zip','intl','mbstring','sodium')) {
        if ($phpIni -notmatch "extension=$extension") { throw "Required PHP extension is missing: $extension" }
    }

    Write-Host '[ OK ] Native runtime configuration contract passed.'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
