#Requires -Version 7.0

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PayloadRoot,
    [Parameter(Mandatory = $true)][string] $EvidenceRoot,
    [int] $DatabasePort = 43307,
    [int] $PhpPort = 49070,
    [int] $HttpPort = 48080
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function ConvertTo-ForwardSlash([string] $Path) { $Path.Replace('\', '/') }

function Wait-TcpPort([int] $Port, [int] $Attempts = 60) {
    foreach ($attempt in 1..$Attempts) {
        $client = [Net.Sockets.TcpClient]::new()
        try {
            $pending = $client.ConnectAsync('127.0.0.1', $Port)
            if ($pending.Wait(500) -and $client.Connected) { return }
        }
        catch { }
        finally { $client.Dispose() }
        Start-Sleep -Milliseconds 500
    }
    throw "Port 127.0.0.1:$Port did not become ready."
}

function Invoke-Checked([string] $File, [string[]] $Arguments, [string] $WorkingDirectory, [string] $LogPath) {
    Push-Location $WorkingDirectory
    try {
        $output = & $File @Arguments 2>&1
        $exitCode = $LASTEXITCODE
        @($output) | Set-Content -LiteralPath $LogPath -Encoding UTF8
        if ($exitCode -ne 0) { throw "Command failed ($exitCode): $File $($Arguments -join ' '). See $LogPath" }
        return @($output)
    }
    finally { Pop-Location }
}

$payload = (Resolve-Path -LiteralPath $PayloadRoot).Path
$evidence = [IO.Path]::GetFullPath($EvidenceRoot)
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$sandbox = Join-Path ([IO.Path]::GetFullPath((Join-Path $payload '..'))) ('native-sandbox-' + [guid]::NewGuid().ToString('N'))
$backend = Join-Path $payload 'app\backend'
$phpRoot = Join-Path $payload 'runtime\php'
$mariaRoot = Join-Path $payload 'runtime\mariadb'
$caddy = Join-Path $payload 'runtime\caddy\caddy.exe'
$processes = [Collections.Generic.List[object]]::new()
$result = [ordered]@{
    status = 'running'
    started_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    payload_root = $payload
    ports = [ordered]@{ mariadb = $DatabasePort; php_fastcgi = $PhpPort; http = $HttpPort }
    runtime = [ordered]@{}
    database = [ordered]@{}
    web = [ordered]@{}
    scheduler_child = [ordered]@{}
    processes = @()
    limitations = @('No Windows services registered','No Startup entry created','No UAC flow executed','No host restart performed','No printer or clean-machine installation exercised')
}

try {
    foreach ($relative in @('database','config/php-scan-disabled','storage/app/private','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs','cache/views','logs','state','backups')) {
        New-Item -ItemType Directory -Path (Join-Path $sandbox $relative) -Force | Out-Null
    }

    $dataPath = ConvertTo-ForwardSlash (Join-Path $sandbox 'database')
    $mariaPath = ConvertTo-ForwardSlash $mariaRoot
    $mariaLog = ConvertTo-ForwardSlash (Join-Path $sandbox 'logs\mariadb-error.log')
    $mariaIni = Join-Path $sandbox 'config\my.ini'
    @"
[mysqld]
basedir=$mariaPath
datadir=$dataPath
port=$DatabasePort
bind-address=127.0.0.1
skip-name-resolve
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
log-error=$mariaLog
pid-file=$dataPath/mariadb.pid
[client]
host=127.0.0.1
port=$DatabasePort
protocol=tcp
"@ | Set-Content -LiteralPath $mariaIni -Encoding UTF8

    $rootPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    $appPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    Invoke-Checked -File (Join-Path $mariaRoot 'bin\mariadb-install-db.exe') -Arguments @("--datadir=$(Join-Path $sandbox 'database')", "--password=$rootPassword", "--port=$DatabasePort", "--config=$mariaIni", '--silent') -WorkingDirectory $sandbox -LogPath (Join-Path $evidence 'mariadb-initialize.log') | Out-Null

    $mariaProcess = Start-Process -FilePath (Join-Path $mariaRoot 'bin\mariadbd.exe') -ArgumentList @("--defaults-file=$mariaIni", '--console') -WorkingDirectory $sandbox -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence 'mariadb.stdout.log') -RedirectStandardError (Join-Path $evidence 'mariadb.stderr.log') -PassThru
    $processes.Add([pscustomobject]@{ role = 'mariadb'; process = $mariaProcess })
    Wait-TcpPort -Port $DatabasePort

    $adminIni = Join-Path $sandbox 'config\admin-client.ini'
    @"
[client]
user=root
password=$rootPassword
host=127.0.0.1
port=$DatabasePort
protocol=tcp
"@ | Set-Content -LiteralPath $adminIni -Encoding UTF8
    $schema = 'shospital_native_sandbox'
    $sql = "CREATE DATABASE ``$schema`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'hospital_sandbox'@'127.0.0.1' IDENTIFIED BY '$appPassword'; GRANT ALL PRIVILEGES ON ``$schema``.* TO 'hospital_sandbox'@'127.0.0.1'; FLUSH PRIVILEGES;"
    Invoke-Checked -File (Join-Path $mariaRoot 'bin\mariadb.exe') -Arguments @("--defaults-extra-file=$adminIni", '--execute', $sql) -WorkingDirectory $sandbox -LogPath (Join-Path $evidence 'database-bootstrap.log') | Out-Null

    $extensionRoot = ConvertTo-ForwardSlash (Join-Path $phpRoot 'ext')
    $sessionRoot = ConvertTo-ForwardSlash (Join-Path $sandbox 'storage\framework\sessions')
    $phpLog = ConvertTo-ForwardSlash (Join-Path $sandbox 'logs\php-error.log')
    $phpIni = Join-Path $sandbox 'config\php.ini'
    @"
[PHP]
expose_php=Off
display_errors=Off
log_errors=On
error_log="$phpLog"
memory_limit=256M
date.timezone=America/Tegucigalpa
extension_dir="$extensionRoot"
session.save_path="$sessionRoot"
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
"@ | Set-Content -LiteralPath $phpIni -Encoding UTF8

    $randomBytes = [byte[]]::new(32)
    [Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
    $environment = [ordered]@{
        APP_NAME = 'S_Hospital'; APP_ENV = 'production'; APP_KEY = 'base64:' + [Convert]::ToBase64String($randomBytes); APP_DEBUG = 'false'; APP_URL = "http://127.0.0.1:$HttpPort"
        LOG_CHANNEL = 'stack'; LOG_LEVEL = 'warning'; DB_CONNECTION = 'mysql'; DB_HOST = '127.0.0.1'; DB_PORT = [string]$DatabasePort; DB_DATABASE = $schema; DB_USERNAME = 'hospital_sandbox'; DB_APP_ACCOUNT_HOST = '127.0.0.1'; DB_PASSWORD = $appPassword
        SESSION_DRIVER = 'file'; SESSION_SECURE_COOKIE = 'false'; SANCTUM_STATEFUL_DOMAINS = "127.0.0.1:$HttpPort"; CACHE_STORE = 'database'; QUEUE_CONNECTION = 'database'; BROADCAST_CONNECTION = 'null'; FILESYSTEM_DISK = 'local'; HOSPITAL_ALLOW_INSECURE_HTTP = '1'
        HOSPITAL_NATIVE_DATA_ROOT = $sandbox; LARAVEL_STORAGE_PATH = (Join-Path $sandbox 'storage'); APP_CONFIG_CACHE = (Join-Path $sandbox 'cache\config.php'); APP_EVENTS_CACHE = (Join-Path $sandbox 'cache\events.php'); APP_PACKAGES_CACHE = (Join-Path $sandbox 'cache\packages.php'); APP_ROUTES_CACHE = (Join-Path $sandbox 'cache\routes.php'); APP_SERVICES_CACHE = (Join-Path $sandbox 'cache\services.php'); VIEW_COMPILED_PATH = (Join-Path $sandbox 'cache\views'); HOSPITAL_DUMP_BINARY = (Join-Path $mariaRoot 'bin\mariadb-dump.exe')
        HOSPITAL_BACKUP_ENCRYPTION_KEY = [Convert]::ToBase64String($randomBytes); PHPRC = $phpIni; PHP_INI_SCAN_DIR = (Join-Path $sandbox 'config\php-scan-disabled'); PHP_FCGI_MAX_REQUESTS = '0'
    }
    foreach ($entry in $environment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, 'Process') }

    $php = Join-Path $phpRoot 'php.exe'
    $probe = Invoke-Checked -File $php -Arguments @('-c',$phpIni,'-r','echo json_encode(["php"=>PHP_VERSION,"pdo_mysql"=>extension_loaded("pdo_mysql"),"sodium"=>function_exists("sodium_crypto_pwhash")]);') -WorkingDirectory $backend -LogPath (Join-Path $evidence 'php-runtime-probe.log')
    $result.runtime = ($probe -join '') | ConvertFrom-Json
    Invoke-Checked -File $php -Arguments @('-c',$phpIni,'artisan','migrate','--force','--no-interaction') -WorkingDirectory $backend -LogPath (Join-Path $evidence 'artisan-migrate.log') | Out-Null
    Invoke-Checked -File $php -Arguments @('-c',$phpIni,'artisan','db:seed','--class=ProductionInstallationSeeder','--force','--no-interaction') -WorkingDirectory $backend -LogPath (Join-Path $evidence 'artisan-seed.log') | Out-Null

    $appIni = Join-Path $sandbox 'config\app-client.ini'
    @"
[client]
user=hospital_sandbox
password=$appPassword
host=127.0.0.1
port=$DatabasePort
protocol=tcp
database=$schema
"@ | Set-Content -LiteralPath $appIni -Encoding UTF8
    $countsOutput = Invoke-Checked -File (Join-Path $mariaRoot 'bin\mariadb.exe') -Arguments @("--defaults-extra-file=$appIni", '--batch', '--skip-column-names', '--execute', "SELECT (SELECT COUNT(*) FROM migrations),(SELECT COUNT(*) FROM services),(SELECT COUNT(*) FROM roles),(SELECT COUNT(*) FROM users),(SELECT COUNT(*) FROM fiscal_settings);") -WorkingDirectory $sandbox -LogPath (Join-Path $evidence 'database-counts.log')
    $counts = (($countsOutput -join '').Trim() -split "`t")
    $result.database = [ordered]@{ migrations = [int]$counts[0]; services = [int]$counts[1]; roles = [int]$counts[2]; users = [int]$counts[3]; fiscal_settings = [int]$counts[4]; initial_seed = 'ProductionInstallationSeeder' }
    if ($result.database.users -ne 0) { throw 'Production installation seed created a predefined human user.' }
    if ($result.database.fiscal_settings -ne 0) { throw 'Production installation seed invented institutional fiscal data.' }

    $phpProcess = Start-Process -FilePath (Join-Path $phpRoot 'php-cgi.exe') -ArgumentList @('-c',$phpIni,'-b',"127.0.0.1:$PhpPort") -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence 'php-fastcgi.stdout.log') -RedirectStandardError (Join-Path $evidence 'php-fastcgi.stderr.log') -PassThru
    $processes.Add([pscustomobject]@{ role = 'php-fastcgi'; process = $phpProcess })
    Wait-TcpPort -Port $PhpPort

    $publicRoot = ConvertTo-ForwardSlash (Join-Path $backend 'public')
    $caddyFile = Join-Path $sandbox 'config\Caddyfile'
    @"
{
    auto_https off
    admin off
}
http://127.0.0.1:$HttpPort {
    root * "$publicRoot"
    php_fastcgi 127.0.0.1:$PhpPort {
        try_files {path} /index.php
    }
    file_server
}
"@ | Set-Content -LiteralPath $caddyFile -Encoding UTF8
    $caddyProcess = Start-Process -FilePath $caddy -ArgumentList @('run','--config',$caddyFile,'--adapter','caddyfile') -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $evidence 'caddy.stdout.log') -RedirectStandardError (Join-Path $evidence 'caddy.stderr.log') -PassThru
    $processes.Add([pscustomobject]@{ role = 'caddy'; process = $caddyProcess })
    Wait-TcpPort -Port $HttpPort

    $up = Invoke-WebRequest -Uri "http://127.0.0.1:$HttpPort/up" -UseBasicParsing -TimeoutSec 10
    $login = Invoke-WebRequest -Uri "http://127.0.0.1:$HttpPort/login" -UseBasicParsing -TimeoutSec 10
    if ($up.StatusCode -ne 200 -or $login.StatusCode -ne 200) { throw 'Caddy/PHP did not serve health and login routes.' }
    $assetMatches = [regex]::Matches($login.Content, '(?:src|href)="([^"]+\.(?:js|css))"')
    if ($assetMatches.Count -lt 2) { throw 'Login SPA did not reference its built JS and CSS assets.' }
    $assetStatuses = @()
    foreach ($match in $assetMatches) {
        $asset = Invoke-WebRequest -Uri ([uri]::new([uri]"http://127.0.0.1:$HttpPort", $match.Groups[1].Value)) -UseBasicParsing -TimeoutSec 10
        $assetStatuses += [ordered]@{ path = $match.Groups[1].Value; status = $asset.StatusCode; bytes = $asset.RawContentLength }
    }
    $result.web = [ordered]@{ health_status = $up.StatusCode; login_status = $login.StatusCode; final_frontend = ($login.Content -match 'index-DGoCYvdd\.js' -and $login.Content -match 'index-YimShJE8\.css'); assets = $assetStatuses }
    if (-not $result.web.final_frontend) { throw 'Served HTML is not the authorized final frontend build.' }

    # `schedule:run` is the exact child command created by `schedule:work`.
    # The inherited PHPRC/scan settings are reported by a separate child PHP and
    # the real scheduler command must bootstrap with the same extensions.
    $childProbe = Invoke-Checked -File $php -Arguments @('-r','echo json_encode(["loaded_ini"=>php_ini_loaded_file(),"pdo_mysql"=>extension_loaded("pdo_mysql"),"sodium"=>function_exists("sodium_crypto_pwhash")]);') -WorkingDirectory $backend -LogPath (Join-Path $evidence 'scheduler-child-php.log')
    $child = ($childProbe -join '') | ConvertFrom-Json
    $scheduleOutput = Invoke-Checked -File $php -Arguments @('artisan','schedule:run','--no-interaction') -WorkingDirectory $backend -LogPath (Join-Path $evidence 'scheduler-run.log')
    $result.scheduler_child = [ordered]@{ loaded_ini = $child.loaded_ini; pdo_mysql = [bool]$child.pdo_mysql; sodium = [bool]$child.sodium; schedule_run_exit = 0; output = (($scheduleOutput -join "`n").Replace($sandbox,'<SANDBOX>')) }
    if (-not $result.scheduler_child.pdo_mysql -or -not $result.scheduler_child.sodium -or [IO.Path]::GetFullPath([string]$result.scheduler_child.loaded_ini) -ne [IO.Path]::GetFullPath($phpIni)) { throw 'Scheduler child PHP did not inherit the canonical runtime configuration.' }

    $result.status = 'passed'
}
catch {
    $result.status = 'failed'
    $result['error'] = $_.Exception.Message
    throw
}
finally {
    $stopped = @()
    $processRecords = @($processes)
    [array]::Reverse($processRecords)
    foreach ($record in $processRecords) {
        $pidValue = $record.process.Id
        $wasRunning = $null -ne (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)
        if ($wasRunning) { Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue; Wait-Process -Id $pidValue -Timeout 10 -ErrorAction SilentlyContinue }
        $alive = $null -ne (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)
        $stopped += [ordered]@{ role = $record.role; pid = $pidValue; started = $wasRunning; stopped = -not $alive }
    }
    $result.processes = $stopped
    $result.finished_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    $result.sandbox_root = $sandbox
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidence 'native-runtime-sandbox.json') -Encoding UTF8
}

$result | ConvertTo-Json -Depth 8
