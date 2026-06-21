param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path -LiteralPath $Root).Path

$runnerPath = Join-Path $Root 'scripts\run_backend_tests_fast_mysql.ps1'
$testCasePath = Join-Path $Root 'backend\tests\TestCase.php'
$commandPath = Join-Path $Root 'backend\app\Console\Commands\PrepareGoldenTestDatabaseCommand.php'
$hashPath = Join-Path $Root 'backend\app\Support\Testing\MigrationHash.php'
$phpunitMysqlPath = Join-Path $Root 'backend\phpunit.mysql.xml'

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Require-File([string] $path, [string] $label) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "$label missing at $path"
        return $false
    }

    Add-Pass "$label found"
    return $true
}

function Require-Content([string] $content, [string] $pattern, [string] $label) {
    if ($content -notmatch $pattern) {
        Add-Failure $label
        return
    }

    Add-Pass $label
}

function Forbid-Content([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Failure $label
        return
    }

    Add-Pass $label
}

$requiredFiles = @(
    @{ Path = $runnerPath; Label = 'Fast MySQL golden runner' },
    @{ Path = $testCasePath; Label = 'Laravel base TestCase' },
    @{ Path = $commandPath; Label = 'Golden database artisan command' },
    @{ Path = $hashPath; Label = 'Migration hash support' },
    @{ Path = $phpunitMysqlPath; Label = 'MySQL phpunit configuration' }
)

$missingRequiredFile = $false
foreach ($file in $requiredFiles) {
    if (-not (Require-File $file.Path $file.Label)) {
        $missingRequiredFile = $true
    }
}

if ($missingRequiredFile) {
    Write-Host ''
    Write-Host "GOLDEN_DB_RUNNER_SAFETY: NO ($($failures.Count) issue(s))" -ForegroundColor Red
    exit 1
}

$runner = Get-Content -LiteralPath $runnerPath -Raw
$testCase = Get-Content -LiteralPath $testCasePath -Raw
$command = Get-Content -LiteralPath $commandPath -Raw
$hash = Get-Content -LiteralPath $hashPath -Raw
$phpunitMysql = Get-Content -LiteralPath $phpunitMysqlPath -Raw

Require-Content $runner 'function\s+Test-SafeDatabaseName' 'Runner validates database names before preparing tests'
Require-Content $runner 's_hospital_test_' 'Runner requires s_hospital_test_ prefix for disposable databases'
Require-Content $runner 's_hospital_golden_' 'Runner requires s_hospital_golden_ prefix for reusable golden databases'
Require-Content $runner 'testing:prepare-golden-database --database=s_hospital_test_probe --dry-run' 'Runner computes migration hash by dry-run only'
Require-Content $runner 's_hospital_test_\$\(\$hash\.Substring\(0, 12\)\)_\$PID' 'Runner defaults to per-process disposable test database'
Require-Content $runner 's_hospital_golden_\$\(\$hash\.Substring\(0, 12\)\)' 'Runner defaults golden database to migration hash'
Require-Content $runner 'HOSPITAL_TEST_ALLOW_EXTERNAL_DB\s*=\s*"1"' 'Runner explicitly opts into external test database'
Require-Content $runner 'HOSPITAL_TEST_DB_ALREADY_MIGRATED\s*=\s*"1"' 'Runner marks cloned database as already migrated'
Require-Content $runner 'phpunit\.mysql\.xml' 'Runner uses dedicated MySQL phpunit configuration'
Require-Content $runner 'DB_HOST=mysql is only valid inside Docker Compose' 'Runner refuses Docker-only DB_HOST from host PowerShell'
Require-Content $runner 'function\s+Test-LocalDatabaseHost' 'Runner classifies local database hosts before preparing golden tests'
Require-Content $runner 'HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST' 'Runner requires exact confirmation before using a non-local test database host'
Require-Content $runner 'Refusing non-local MySQL/MariaDB host' 'Runner fails clearly when a LAN/remote database host is not explicitly confirmed'
Forbid-Content $runner '(?i)migrate:fresh|db:wipe|migrate:reset|docker\s+compose\s+down\s+-v' 'Runner does not contain destructive reset commands'

Require-Content $testCase 'HOSPITAL_TEST_ALLOW_EXTERNAL_DB' 'TestCase requires explicit opt-in for external DB tests'
Require-Content $testCase 'Refusing external test database without safe s_hospital_test_ prefix' 'TestCase refuses unsafe external DB names'
Require-Content $testCase 'HOSPITAL_TEST_DB_ALREADY_MIGRATED' 'TestCase reads already-migrated flag'
Require-Content $testCase 'RefreshDatabaseState::\$migrated\s*=\s*true' 'TestCase prevents RefreshDatabase from rerunning migrations on golden clones'
Require-Content $testCase "DB_CONNECTION'\s*=>\s*'sqlite'" 'TestCase defaults normal tests to SQLite in-memory'

Require-Content $command "config\('app\.env'\)\s*===\s*'production'" 'Golden command refuses production APP_ENV'
Require-Content $command 'isSafeTestingDatabaseName' 'Golden command validates database names'
Require-Content $command 'databaseHostIsAllowedForGoldenTests' 'Golden command validates database host before materialization'
Require-Content $command 'HOSPITAL_TEST_DB_STRATEGY' 'Golden command requires explicit Docker test strategy for service hosts'
Require-Content $command 'HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST' 'Golden command requires exact confirmation before external test database hosts'
Require-Content $command 'quoteIdentifier' 'Golden command quotes database/table identifiers'
Require-Content $command 'MigrationHash::forLaravelBase' 'Golden command keys database by migration hash'
Require-Content $command '_test_golden_metadata' 'Golden command stores golden metadata hash'
Require-Content $command 'DROP DATABASE IF EXISTS' 'Golden command only drops disposable checked databases'
Require-Content $command 'CREATE DATABASE' 'Golden command creates disposable checked databases'

Require-Content $hash 'database/migrations/\*\.php' 'Migration hash includes migrations'
Require-Content $hash 'filesUnder\(\$basePath.''/database/seeders''\)' 'Migration hash includes all seeders recursively'
Require-Content $hash 'RecursiveDirectoryIterator' 'Migration hash scans nested seeder/data files'
Require-Content $hash 'str_starts_with\(\$normalizedPath, \$basePath\)' 'Migration hash normalizes paths relative to backend root'

Require-Content $phpunitMysql 'APP_ENV"\s+value="testing"' 'MySQL phpunit configuration forces testing APP_ENV'
Forbid-Content $phpunitMysql 'DB_DATABASE"\s+value="[^"]+"' 'MySQL phpunit configuration does not hardcode a database name'

Write-Host ''
if ($failures.Count -gt 0) {
    Write-Host "GOLDEN_DB_RUNNER_SAFETY: NO ($($failures.Count) issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host 'GOLDEN_DB_RUNNER_SAFETY: YES' -ForegroundColor Green

