param(
    [Parameter(Mandatory=$true)][string]$Database,
    [Parameter(Mandatory=$true)][string]$DatabasePassword,
    [Parameter(Mandatory=$true)][string]$SeedPassword,
    [int]$DatabasePort = 3318,
    [int]$HttpPort = 18082,
    [int]$FastCgiPort = 19082
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ($Database -notmatch '^sh_ai_f3_[a-zA-Z0-9_]+$' -or $DatabasePort -eq 3307 -or $HttpPort -eq 8000) {
    throw 'Use a dedicated sh_ai_f3_* laboratory outside the installed ports.'
}
$lab = Join-Path $repo 'artifacts/f3-native-lab'
New-Item -ItemType Directory -Path $lab -Force | Out-Null
foreach ($relative in @('storage/app/private/backups','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs','cache/views')) {
    New-Item -ItemType Directory -Path (Join-Path $lab $relative) -Force | Out-Null
}
$phpRoot = Join-Path $repo 'artifacts/native-payload/runtime/php'
$phpIni = Join-Path $lab 'php.ini'
$extensionDir = (Join-Path $phpRoot 'ext').Replace('\','/')
$ini = @"
extension_dir="$extensionDir"
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
memory_limit=256M
date.timezone=America/Tegucigalpa
"@
[IO.File]::WriteAllText($phpIni,$ini,(New-Object Text.UTF8Encoding($false)))
$env:APP_ENV = 'testing'
$env:APP_DEBUG = 'false'
$env:APP_KEY = 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
$env:APP_URL = "http://127.0.0.1:$HttpPort"
$env:APP_CONFIG_CACHE = Join-Path $lab 'config.php'
$env:APP_ROUTES_CACHE = Join-Path $lab 'routes.php'
$env:APP_EVENTS_CACHE = Join-Path $lab 'cache/events.php'
$env:APP_PACKAGES_CACHE = Join-Path $lab 'cache/packages.php'
$env:APP_SERVICES_CACHE = Join-Path $lab 'cache/services.php'
$env:LARAVEL_STORAGE_PATH = Join-Path $lab 'storage'
$env:VIEW_COMPILED_PATH = Join-Path $lab 'cache/views'
$env:HOSPITAL_ALLOW_INSECURE_HTTP = '1'
$env:DB_CONNECTION = 'mysql'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = "$DatabasePort"
$env:DB_DATABASE = $Database
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = $DatabasePassword
$env:DB_URL = ''
$env:CACHE_STORE = 'database'
$env:QUEUE_CONNECTION = 'sync'
$env:SESSION_DRIVER = 'database'
$env:SESSION_DOMAIN = ''
$env:SESSION_SECURE_COOKIE = 'false'
$env:SESSION_SAME_SITE = 'lax'
$env:SANCTUM_STATEFUL_DOMAINS = "127.0.0.1:$HttpPort,localhost:$HttpPort"
$env:BROADCAST_CONNECTION = 'null'
$env:LOG_CHANNEL = 'single'
$env:HOSPITAL_DUMP_BINARY = Join-Path $repo 'artifacts/native-payload/runtime/mariadb/bin/mariadb-dump.exe'
$env:HOSPITAL_BACKUP_ENCRYPTION_KEY = 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
$env:E2E_SEED_PASSWORD = $SeedPassword
$env:PHPRC = $phpIni
$env:PHP_FCGI_MAX_REQUESTS = '0'
Push-Location (Join-Path $repo 'backend')
try {
    & (Join-Path $phpRoot 'php.exe') -c $phpIni artisan migrate --force
    if ($LASTEXITCODE -ne 0) { throw 'Laboratory migrations failed.' }
    & (Join-Path $phpRoot 'php.exe') -c $phpIni artisan hospital:prepare-e2e-release-data
    if ($LASTEXITCODE -ne 0) { throw 'Laboratory fixture preparation failed.' }
    & (Join-Path $phpRoot 'php.exe') -c $phpIni (Join-Path $PSScriptRoot 'prepare-native-e2e-invoices.php')
    if ($LASTEXITCODE -ne 0) { throw 'Laboratory report fixture preparation failed.' }
} finally { Pop-Location }
$backendPublic = (Join-Path $repo 'backend/public').Replace('\','/')
$frontendDist = (Join-Path $repo 'frontend/dist').Replace('\','/')
if (-not (Test-Path (Join-Path $frontendDist 'index.html'))) { throw 'Build frontend production before starting this laboratory.' }
$caddyConfig = @"
{
    admin off
    auto_https off
}
http://127.0.0.1:$HttpPort {
    handle /api/* {
        root * $backendPublic
        php_fastcgi 127.0.0.1:$FastCgiPort
        file_server
    }
    handle /sanctum/* {
        root * $backendPublic
        php_fastcgi 127.0.0.1:$FastCgiPort
        file_server
    }
    handle /up {
        root * $backendPublic
        php_fastcgi 127.0.0.1:$FastCgiPort
    }
    handle {
        root * $frontendDist
        try_files {path} /index.html
        file_server
    }
}
"@
$configPath = Join-Path $lab 'Caddyfile'
[IO.File]::WriteAllText($configPath,$caddyConfig,(New-Object Text.UTF8Encoding($false)))
$fcgi = Start-Process -FilePath (Join-Path $phpRoot 'php-cgi.exe') -ArgumentList @('-c', $phpIni, '-b', "127.0.0.1:$FastCgiPort") -WindowStyle Hidden -PassThru -WorkingDirectory (Join-Path $repo 'backend') -RedirectStandardOutput (Join-Path $lab 'php.stdout.log') -RedirectStandardError (Join-Path $lab 'php.stderr.log')
$caddy = Start-Process -FilePath (Join-Path $repo 'artifacts/native-payload/runtime/caddy/caddy.exe') -ArgumentList @('run','--config',$configPath,'--adapter','caddyfile') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $lab 'caddy.stdout.log') -RedirectStandardError (Join-Path $lab 'caddy.stderr.log')
@{ database=$Database; database_port=$DatabasePort; http_port=$HttpPort; fastcgi_port=$FastCgiPort; php_pid=$fcgi.Id; caddy_pid=$caddy.Id; base_url=$env:APP_URL } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $lab 'processes.json') -Encoding UTF8
Write-Output "F3 laboratory started: $($env:APP_URL), PHP PID $($fcgi.Id), Caddy PID $($caddy.Id)."
