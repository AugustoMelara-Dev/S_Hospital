param(
    [int] $Port = 18082,
    [int] $LoadRequests = 72,
    [int] $LoadConcurrency = 8
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$network = "shospital-field-concurrency-$stamp"
$dbContainer = "shospital-field-concurrency-db-$stamp"
$apiContainer = "shospital-field-concurrency-api-$stamp"
$database = "s_hospital_concurrency_$stamp"
$rootPassword = "Root!${stamp}Field"
$validationUser = "concurrency.local$stamp.validacion"
$validationPassword = "Field!$stamp`#Validation"
$baseUrl = "http://127.0.0.1:$Port"
$evidencePath = "qa/field-acceptance/concurrency-load-local-$stamp.md"

function Invoke-DockerBackend {
    param(
        [string[]] $Command
    )

    docker run --rm `
        --network $network `
        -v "${repoRoot}:/repo" `
        -w /repo/backend `
        --env APP_ENV=testing `
        --env APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= `
        --env APP_DEBUG=false `
        --env APP_URL=$baseUrl `
        --env FRONTEND_URL=$baseUrl `
        --env SESSION_DRIVER=file `
        --env CACHE_STORE=file `
        --env QUEUE_CONNECTION=sync `
        --env DB_CONNECTION=mysql `
        --env DB_HOST=mariadb `
        --env DB_PORT=3306 `
        --env DB_DATABASE=$database `
        --env DB_USERNAME=root `
        --env DB_PASSWORD=$rootPassword `
        --env HOSPITAL_ALLOW_FINAL_VALIDATION_USERS=1 `
        --env HOSPITAL_CONFIRM_VALIDATION_USER=$validationUser `
        --env HOSPITAL_VALIDATION_USER_PASSWORD=$validationPassword `
        s-hospital-v1-1-review-backend `
        @Command
}

try {
    Set-Location $repoRoot

    docker network create $network | Out-Null

    docker run -d `
        --name $dbContainer `
        --network $network `
        --network-alias mariadb `
        --env MARIADB_ROOT_PASSWORD=$rootPassword `
        mariadb:11.4.3 | Out-Null

    $dbReady = $false
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        try {
            docker exec $dbContainer mariadb -uroot "--password=$rootPassword" -e "SELECT 1;" *> $null
            if ($LASTEXITCODE -eq 0) {
                $dbReady = $true
                break
            }
        } catch {
        }
        Start-Sleep -Seconds 2
    }

    if (-not $dbReady) {
        throw "MariaDB disposable container did not become ready."
    }

    docker exec $dbContainer mariadb -uroot "--password=$rootPassword" -e "CREATE DATABASE ``$database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" | Out-Null

    Invoke-DockerBackend -Command @("php", "artisan", "migrate:fresh", "--seed", "--force")
    Invoke-DockerBackend -Command @("php", "artisan", "hospital:validation-user", "create", "--username=$validationUser", "--role=cajero")

    docker run -d `
        --name $apiContainer `
        --network $network `
        -p "127.0.0.1:${Port}:8000" `
        -v "${repoRoot}:/repo" `
        -w /repo/backend `
        --env APP_ENV=testing `
        --env APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= `
        --env APP_DEBUG=false `
        --env APP_URL=$baseUrl `
        --env FRONTEND_URL=$baseUrl `
        --env SESSION_DRIVER=file `
        --env CACHE_STORE=file `
        --env QUEUE_CONNECTION=sync `
        --env DB_CONNECTION=mysql `
        --env DB_HOST=mariadb `
        --env DB_PORT=3306 `
        --env DB_DATABASE=$database `
        --env DB_USERNAME=root `
        --env DB_PASSWORD=$rootPassword `
        s-hospital-v1-1-review-backend `
        php -S 0.0.0.0:8000 -t public public/index.php | Out-Null

    $apiReady = $false
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing -TimeoutSec 60
            if ($response.StatusCode -eq 200) {
                $apiReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 3
        }
    }

    if (-not $apiReady) {
        docker logs --tail 120 $apiContainer
        throw "Disposable Laravel API did not become ready at $baseUrl."
    }

    $env:HOSPITAL_VALIDATE_REAL_MYSQL = "1"
    $env:HOSPITAL_CONCURRENCY_BASE_URL = $baseUrl
    $env:HOSPITAL_CONFIRM_CONCURRENCY_TARGET = $baseUrl
    $env:HOSPITAL_CONCURRENCY_TARGET_ENV = "local-disposable-validation"
    $env:HOSPITAL_CONCURRENCY_LOGIN = $validationUser
    $env:HOSPITAL_CONCURRENCY_PASSWORD = $validationPassword
    $env:HOSPITAL_LOAD_REQUESTS = "$LoadRequests"
    $env:HOSPITAL_LOAD_CONCURRENCY = "$LoadConcurrency"
    $env:HOSPITAL_CONCURRENCY_EVIDENCE_PATH = $evidencePath

    node scripts/validate_mysql_concurrency_under_load.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "Concurrency/load validator failed with exit code $LASTEXITCODE."
    }

    Add-Content -LiteralPath (Join-Path $repoRoot $evidencePath) -Value @"

## Limits

This proof used a local disposable Docker/MariaDB target on 127.0.0.1. It does not replace the required real LAN load/concurrency gate with two physical client PCs and a hospital operator. Production database touched: NO. Real patient data used: NO.
"@

    Write-Output "CONCURRENCY_LOAD_LOCAL_PASS evidence=$evidencePath baseUrl=$baseUrl requests=$LoadRequests concurrency=$LoadConcurrency database=$database"
} finally {
    Remove-Item Env:\HOSPITAL_VALIDATE_REAL_MYSQL -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_CONCURRENCY_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_CONFIRM_CONCURRENCY_TARGET -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_CONCURRENCY_TARGET_ENV -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_CONCURRENCY_LOGIN -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_CONCURRENCY_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_LOAD_REQUESTS -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_LOAD_CONCURRENCY -ErrorAction SilentlyContinue
    Remove-Item Env:\HOSPITAL_CONCURRENCY_EVIDENCE_PATH -ErrorAction SilentlyContinue

    try {
        docker rm -f $apiContainer 2>$null | Out-Null
    } catch {
    }
    try {
        docker rm -f $dbContainer 2>$null | Out-Null
    } catch {
    }
    try {
        docker network rm $network 2>$null | Out-Null
    } catch {
    }
}
