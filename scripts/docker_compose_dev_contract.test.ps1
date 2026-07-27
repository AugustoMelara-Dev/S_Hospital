$ErrorActionPreference = "Stop"

$composePath = Join-Path (Split-Path $PSScriptRoot -Parent) "docker-compose.yml"
$content = Get-Content -LiteralPath $composePath -Raw

function Assert-Contains([string] $needle, [string] $message) {
    if (-not $content.Contains($needle)) {
        throw $message
    }
}

function Assert-NotContains([string] $needle, [string] $message) {
    if ($content.Contains($needle)) {
        throw $message
    }
}

Assert-Contains `
    'HOSPITAL_BACKUP_ENCRYPTION_KEY: ${HOSPITAL_BACKUP_ENCRYPTION_KEY:?HOSPITAL_BACKUP_ENCRYPTION_KEY is required}' `
    "Development backend must receive the persistent backup encryption key."

Assert-Contains `
    'command: sh -c "pnpm install --frozen-lockfile && pnpm run dev -- --host 0.0.0.0"' `
    "Development frontend must install exactly from pnpm-lock.yaml."

Assert-NotContains `
    'command: sh -c "pnpm install && pnpm run dev -- --host 0.0.0.0"' `
    "Development frontend must not rewrite pnpm-lock.yaml at startup."

Assert-NotContains `
    'command: sh -c "npm install && npm run dev -- --host 0.0.0.0"' `
    "Development frontend must not rely on the npm registry."

$lockPath = Join-Path (Split-Path $PSScriptRoot -Parent) "frontend\pnpm-lock.yaml"
$lockContent = Get-Content -LiteralPath $lockPath -Raw

foreach ($linuxPackage in @("@emnapi/core", "@emnapi/runtime")) {
    if (-not $lockContent.Contains($linuxPackage)) {
        throw "pnpm-lock.yaml must include Linux optional package: $linuxPackage"
    }
}

Assert-Contains `
    '  queue-worker:' `
    "Development compose must run the database backup queue."

Assert-Contains `
    'php artisan queue:work --queue=backups --tries=1 --timeout=600 --memory=256' `
    "Development backup worker must match the reviewed production queue contract."

Assert-Contains `
    '  realtime-worker:' `
    "Development compose must consume queued operational broadcasts."

Assert-Contains `
    'php artisan queue:work --queue=default --tries=3 --timeout=60 --memory=128' `
    "Development realtime worker must not compete with long-running backups."

Assert-Contains `
    '  scheduler:' `
    "Development compose must run the Laravel scheduler."

Assert-Contains `
    'php artisan schedule:run --no-interaction' `
    "Development scheduler must execute Laravel schedules."

Assert-Contains `
    'php artisan hospital:scheduler-tick --result=ok' `
    "Development scheduler must persist an operational heartbeat."

Assert-Contains `
    'curl --max-time 2 -fsS http://127.0.0.1:8000/healthz.txt' `
    "Development health probes must stop before Docker starts another probe."

Assert-Contains `
    'PHP_CLI_SERVER_WORKERS: ${PHP_CLI_SERVER_WORKERS:-8}' `
    "Development PHP must serve concurrent browser, API, and health-check requests."

Write-Host "[ OK ] development compose keeps backups recoverable and frontend installs reproducible"
