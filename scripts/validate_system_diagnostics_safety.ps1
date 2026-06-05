param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
        return Get-Content -LiteralPath $path -Raw
    }

    Add-Failure "No se encontro $relativePath."
    return ""
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

$aboutView = Read-RequiredFile "frontend\src\features\about\AboutView.tsx"
$aboutTest = Read-RequiredFile "frontend\src\features\about\AboutView.test.tsx"
$serverStatusHook = Read-RequiredFile "frontend\src\hooks\useServerStatus.ts"
$serverStatusHookTest = Read-RequiredFile "frontend\src\hooks\useServerStatus.test.tsx"
$apiTypes = Read-RequiredFile "frontend\src\lib\api\types.ts"
$systemStatusController = Read-RequiredFile "backend\app\Http\Controllers\SystemStatusController.php"
$systemStatusTest = Read-RequiredFile "backend\tests\Feature\SystemStatusTest.php"
$apiRoutes = Read-RequiredFile "backend\routes\api.php"

if ($aboutView -ne "") {
    foreach ($requiredText in @(
        'Informacion del sistema',
        'Resumen operativo',
        'Todo bien',
        'Error',
        'Diagnostico administrativo',
        'Pulso operativo administrativo',
        'Lectura para soporte',
        'BarChart',
        'useElementWidth',
        'scheduler_heartbeat',
        'sin claves ni rutas internas',
        'Backend',
        'Base de datos',
        'Interfaz web',
        'Ultimo respaldo',
        'Respaldos en espera',
        'Carga de respaldos',
        'Retardo DB',
        'Respuesta DB',
        'Conexiones DB',
        'Actividad',
        'Sin respaldos acumulados',
        'Base local sin replica',
        'Version instalada',
        'Red local',
        'Migraciones',
        'Hora del servidor',
        'Espacio libre para respaldos',
        'Acceso LAN',
        'system.status.view'
    )) {
        Test-Contains $aboutView ([regex]::Escape($requiredText)) "About diagnostics include required text: $requiredText"
    }

    Test-Contains $aboutView 'canViewAdminDiagnostics' "About diagnostics gate advanced details by permission"
    Test-Contains $aboutView 'adminDiagnosticItems' "About diagnostics centralize admin status labels"
    Test-Contains $aboutView 'adminHealthMetrics' "About diagnostics centralize admin health dashboard metrics"
    Test-Contains $aboutView 'OperationalHealth' "About diagnostics consume operational health metrics"
    Test-Contains $aboutView 'dbLagLabel' "About diagnostics translate database lag safely"
    Test-Contains $aboutView 'dbLatencyLabel' "About diagnostics translate database latency safely"
    Test-Contains $aboutView 'dbConnectionsLabel' "About diagnostics translate database connections safely"
    Test-Contains $aboutView 'uptimeLabel' "About diagnostics translate backend uptime safely"
    Test-Contains $aboutView 'schedulerHeartbeatLabel' "About diagnostics translate scheduler heartbeat for support"
    Test-Contains $aboutView 'summaryBadgeVariant' "About diagnostics render status levels consistently"
    Test-Contains $aboutView 'formatBytes' "About diagnostics format disk space for operators"
}

if ($serverStatusHook -ne "") {
    foreach ($requiredText in @(
        '/api/system/health',
        'Todo bien',
        'Requiere revision',
        'Error',
        'No se pudo confirmar el servidor local',
        'La base de datos local no responde',
        'Detenga la facturacion',
        'Hay respaldos en espera o con alerta',
        'revise respaldos',
        'worker_recently_active',
        'success_last_24h',
        'failed_last_24h',
        'storage'
    )) {
        Test-Contains $serverStatusHook ([regex]::Escape($requiredText)) "Server status hook includes safe summary behavior: $requiredText"
    }
}

if ($apiTypes -ne "") {
    foreach ($requiredText in @(
        'database_lag',
        'database_perf',
        'queue_size',
        'disk_free_gb',
        'app_uptime_s'
    )) {
        Test-Contains $apiTypes ([regex]::Escape($requiredText)) "Operational health type includes extended safe field: $requiredText"
    }
}

if ($systemStatusController -ne "") {
    foreach ($requiredText in @(
        'environmentStatus',
        'databaseStatus',
        'frontendStatus',
        'networkStatus',
        'backupStatus',
        'runtimeStatus',
        'readinessStatus',
        'preflightStatus',
        'app_version',
        'server_time',
        'timezone',
        'lan_ready',
        'client_url',
        'last_success_at',
        'pending_backup_jobs',
        'failed_jobs_count',
        'free_bytes',
        'pending_migration_count',
        'PRODUCTION_CANDIDATE',
        'OperationalMessageSanitizer::url',
        'OperationalMessageSanitizer::message'
    )) {
        Test-Contains $systemStatusController ([regex]::Escape($requiredText)) "Backend system status includes safe field: $requiredText"
    }

    Test-Contains $apiRoutes 'system/status' "Backend system status route is registered"
    Test-Contains $apiRoutes 'system/health' "Backend public health route is registered"
}

$combinedTests = "$aboutTest`n$serverStatusHookTest`n$systemStatusTest"
foreach ($rule in @(
    @{ Pattern = [regex]::Escape('non-technical language'); Label = 'non-technical language' },
    @{ Pattern = [regex]::Escape('without exposing raw technical details'); Label = 'without exposing raw technical details' },
    @{ Pattern = [regex]::Escape('protected administrative diagnostics'); Label = 'protected administrative diagnostics' },
    @{ Pattern = [regex]::Escape('system status permission'); Label = 'system status permission' },
    @{ Pattern = [regex]::Escape('reads the public operational health endpoint'); Label = 'reads the public operational health endpoint' },
    @{ Pattern = [regex]::Escape('cashier-safe language'); Label = 'cashier-safe language' },
    @{ Pattern = [regex]::Escape('database failures'); Label = 'database failures' },
    @{ Pattern = 'without[_\s-]+secret[_\s-]+values'; Label = 'without secret values' },
    @{ Pattern = 'scheduler[_\s-]+heartbeat[_\s-]+message[_\s-]+is[_\s-]+sanitized|sanitizes[_\s-]+scheduler[_\s-]+heartbeat'; Label = 'sanitized scheduler heartbeat messages' },
    @{ Pattern = [regex]::Escape('admin operational pulse without raw commands or paths'); Label = 'admin operational pulse without raw commands or paths' },
    @{ Pattern = [regex]::Escape('extended admin health metrics from the public health snapshot safely'); Label = 'extended admin health metrics safely' },
    @{ Pattern = [regex]::Escape('system.status.view'); Label = 'system.status.view' }
)) {
    Test-Contains $combinedTests $rule.Pattern "Diagnostics tests cover: $($rule.Label)"
}

$forbiddenUiPatterns = @(
    '(?i)APP_KEY\s*=',
    '(?i)DB_PASSWORD\s*=',
    '(?i)TOKEN\s*=',
    '(?i)SECRET\s*=',
    '(?i)\.env\b',
    '(?i)C:\\',
    '(?i)storage/logs',
    '(?i)queue:work'
)
$uiHasForbiddenText = $false
foreach ($pattern in $forbiddenUiPatterns) {
    if ($aboutView -match $pattern) {
        $uiHasForbiddenText = $true
    }
}

if ($uiHasForbiddenText) {
    Add-Failure "About diagnostics UI exposes forbidden technical details or secret-like text."
} else {
    Add-Pass "About diagnostics UI does not expose forbidden technical details"
}

if ($systemStatusController -match "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*=") {
    Add-Failure "System status controller exposes secret-like assignments."
} else {
    Add-Pass "System status controller does not expose secret-like assignments"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "SYSTEM_DIAGNOSTICS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SYSTEM_DIAGNOSTICS_SAFETY: YES" -ForegroundColor Green
