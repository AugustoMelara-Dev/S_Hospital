param(
    [string]$Database = "",
    [string]$GoldenDatabase = "",
    [string]$Filter = "",
    [string]$EnvFile = "",
    [string]$DbHost = $env:DB_HOST,
    [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { "3306" }),
    [string]$DbUsername = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [int]$ReadyTimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

function Test-SafeDatabaseName([string]$Name, [string]$ExpectedPrefix) {
    return $Name -match '^[A-Za-z0-9_]+$' -and
        $Name.StartsWith($ExpectedPrefix, [System.StringComparison]::Ordinal) -and
        $Name.Length -gt $ExpectedPrefix.Length
}

function Test-LocalDatabaseHost([string]$HostName) {
    return $HostName -match '^(localhost|127\.0\.0\.1|::1)$'
}

function Wait-ForMysqlServer([string]$HostName, [string]$PortNumber, [string]$Username, [string]$Password, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $phpProbe = @"
`$hostName = getenv('DB_HOST');
`$port = getenv('DB_PORT') ?: '3306';
`$username = getenv('DB_USERNAME');
`$password = getenv('DB_PASSWORD');
`$pdo = new PDO("mysql:host={`$hostName};port={`$port};charset=utf8mb4", `$username, `$password, [
    PDO::ATTR_TIMEOUT => 3,
]);
`$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
`$pdo->query('SELECT 1')->fetchColumn();
"@

    $probeFile = New-TemporaryFile
    $probeOutput = ""

    try {
        Set-Content -LiteralPath $probeFile.FullName -Value "<?php`n$phpProbe" -Encoding UTF8

        do {
            $env:DB_HOST = $HostName
            $env:DB_PORT = $PortNumber
            $env:DB_USERNAME = $Username
            $env:DB_PASSWORD = $Password

            try {
                $probeOutput = & php -d default_socket_timeout=3 $probeFile.FullName 2>&1
                $probeExitCode = $LASTEXITCODE
            } catch {
                $probeOutput = $_.Exception.Message
                $probeExitCode = 1
            }

            if ($probeExitCode -eq 0) {
                return
            }

            Start-Sleep -Seconds 2
        } while ((Get-Date) -lt $deadline)
    } finally {
        Remove-Item -LiteralPath $probeFile.FullName -Force -ErrorAction SilentlyContinue
    }

    throw "MySQL/MariaDB test server did not become ready for PDO connections. Last probe output: $probeOutput"
}

function Read-EnvFile([string]$Path) {
    $map = @{}
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $map
    }
    if (-not (Test-Path $Path)) {
        throw "EnvFile not found: $Path"
    }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }
        $parts = $line.Split("=", 2)
        $map[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $map
}

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"

$envValues = Read-EnvFile $EnvFile
if ([string]::IsNullOrWhiteSpace($DbHost) -and $envValues.ContainsKey("DB_HOST")) { $DbHost = $envValues["DB_HOST"] }
if ([string]::IsNullOrWhiteSpace($DbPort) -and $envValues.ContainsKey("DB_PORT")) { $DbPort = $envValues["DB_PORT"] }
if ([string]::IsNullOrWhiteSpace($DbUsername) -and $envValues.ContainsKey("DB_USERNAME")) { $DbUsername = $envValues["DB_USERNAME"] }
if ([string]::IsNullOrWhiteSpace($DbPassword) -and $envValues.ContainsKey("DB_PASSWORD")) { $DbPassword = $envValues["DB_PASSWORD"] }

Write-Host "[golden-db] Computing migration hash..."
$env:APP_ENV = "testing"
$hashOutput = & php "$backend\artisan" testing:prepare-golden-database --database=s_hospital_test_probe --dry-run 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Could not compute migration hash.`n$hashOutput"
}

$hashLine = $hashOutput | Where-Object { $_ -like "Migration hash:*" } | Select-Object -First 1
$hash = ($hashLine -replace '^Migration hash:\s*', '').Trim()
if ($hash.Length -lt 12) {
    throw "Could not parse migration hash from dry-run output."
}
Write-Host "[golden-db] Migration hash: $hash"

if ([string]::IsNullOrWhiteSpace($Database)) {
    $Database = "s_hospital_test_$($hash.Substring(0, 12))_$PID"
}
if ([string]::IsNullOrWhiteSpace($GoldenDatabase)) {
    $GoldenDatabase = "s_hospital_golden_$($hash.Substring(0, 12))"
}

if (-not (Test-SafeDatabaseName $Database "s_hospital_test_")) {
    throw "Refusing unsafe test database name: $Database"
}
if (-not (Test-SafeDatabaseName $GoldenDatabase "s_hospital_golden_")) {
    throw "Refusing unsafe golden database name: $GoldenDatabase"
}
if ([string]::IsNullOrWhiteSpace($DbHost) -or [string]::IsNullOrWhiteSpace($DbUsername)) {
    throw "Set DB_HOST and DB_USERNAME for a disposable MySQL/MariaDB test server."
}
if ($DbHost -eq "mysql") {
    throw "DB_HOST=mysql is only valid inside Docker Compose. Run this script with a host-accessible test DB, for example -DbHost 127.0.0.1 and a published test MariaDB port, or use a dev Compose profile with the repo mounted."
}
if (-not (Test-LocalDatabaseHost $DbHost) -and $env:HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST -ne $DbHost) {
    throw "Refusing non-local MySQL/MariaDB host '$DbHost' for fast tests. Use a local disposable test DB, or set HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST to the exact host only for a disposable remote test server."
}

Write-Host "[golden-db] Waiting for MySQL/MariaDB at ${DbHost}:${DbPort}..."
Wait-ForMysqlServer $DbHost $DbPort $DbUsername $DbPassword $ReadyTimeoutSeconds
Write-Host "[golden-db] MySQL/MariaDB is ready."

Push-Location $backend
try {
    $env:APP_ENV = "testing"
    $env:DB_CONNECTION = "mysql"
    $env:DB_HOST = $DbHost
    $env:DB_PORT = $DbPort
    $env:DB_USERNAME = $DbUsername
    $env:DB_PASSWORD = $DbPassword
    $env:DB_DATABASE = $Database

    Write-Host "[golden-db] Preparing clone '$Database' from '$GoldenDatabase'..."
    php artisan testing:prepare-golden-database --database="$Database" --golden-database="$GoldenDatabase"
    if ($LASTEXITCODE -ne 0) {
        throw "Golden database preparation failed."
    }
    Write-Host "[golden-db] Clone ready."

    $env:HOSPITAL_TEST_ALLOW_EXTERNAL_DB = "1"
    $env:HOSPITAL_TEST_DB_ALREADY_MIGRATED = "1"

    $phpunit = Join-Path $backend "vendor\bin\phpunit"
    $phpunitBat = Join-Path $backend "vendor\bin\phpunit.bat"

    $phpunitArgs = @("--configuration", "phpunit.mysql.xml")
    if (-not [string]::IsNullOrWhiteSpace($Filter)) {
        $phpunitArgs += @("--filter", $Filter)
    }

    Write-Host "[golden-db] Running PHPUnit: $($phpunitArgs -join ' ')"
    if (Test-Path $phpunit) {
        & php $phpunit @phpunitArgs
    } elseif (Test-Path $phpunitBat) {
        & $phpunitBat @phpunitArgs
    } else {
        throw "Could not find PHPUnit runner in vendor\bin."
    }
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
