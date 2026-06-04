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

    Add-Failure "Missing required file: $relativePath"
    return ""
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Test-DoesNotContain([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

$routes = Read-RequiredFile "backend\routes\api.php"
$middleware = Read-RequiredFile "backend\app\Http\Middleware\ThrottleByUser.php"
$bootstrap = Read-RequiredFile "backend\bootstrap\app.php"
$test = Read-RequiredFile "backend\tests\Feature\ThrottleByUserTest.php"
$knownLimitations = Read-RequiredFile "docs\KNOWN_LIMITATIONS.md"
$operativeNotes = Read-RequiredFile "docs\OPERATIVE_NOTES_2026_06_02.md"
$handoff = Read-RequiredFile "qa\FINAL_PRODUCTION_HANDOFF_RESULT.md"

if ($middleware -ne "") {
    Test-Contains $middleware 'class ThrottleByUser' "ThrottleByUser middleware exists"
    Test-Contains $middleware 'getAuthIdentifier' "ThrottleByUser keys authenticated users by user id"
    Test-Contains $middleware 'ip:' "ThrottleByUser has IP fallback for unauthenticated requests"
    Test-Contains $middleware 'Demasiadas solicitudes locales para su usuario' "ThrottleByUser returns human Spanish message"
    Test-Contains $middleware 'Retry-After' "ThrottleByUser returns retry guidance"
    Test-DoesNotContain $middleware '(?i)APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD|storage[\\/]+logs|SQLSTATE' "ThrottleByUser avoids technical/secret details"
}

if ($bootstrap -ne "") {
    Test-Contains $bootstrap "'throttle.user'\s*=>\s*ThrottleByUser::class" "ThrottleByUser alias is registered"
}

if ($routes -ne "") {
    Test-Contains $routes "(?s)Route::post\('/invoices'.*?->middleware\('throttle\.user:60,1'\)" "Invoice creation uses per-user throttle"
    Test-Contains $routes "(?s)Route::post\('/invoices/\{invoice\}/void'.*?->middleware\('throttle\.user:30,1'\)" "Invoice void uses per-user throttle"
    Test-Contains $routes "(?s)Route::post\('/invoices/\{invoice\}/reverse'.*?->middleware\('throttle\.user:10,1'\)" "Invoice reverse uses per-user throttle"
    Test-Contains $routes "(?s)Route::post\('/invoices/\{invoice\}/payments'.*?->middleware\('throttle\.user:60,1'\)" "Payment registration uses per-user throttle"
    Test-Contains $routes "(?s)Route::post\('/invoices/\{invoice\}/payments/\{payment\}/void'.*?->middleware\('throttle\.user:30,1'\)" "Payment void uses per-user throttle"
    Test-Contains $routes "(?s)Route::post\('/cash-sessions/open'.*?->middleware\('throttle\.user:30,1'\)" "Cashbox open uses per-user throttle"
    Test-Contains $routes "(?s)Route::post\('/cash-sessions/\{cashSession\}/close'.*?->middleware\('throttle\.user:30,1'\)" "Cashbox close uses per-user throttle"
    Test-DoesNotContain $routes "(?s)Route::post\('/invoices/\{invoice\}/payments'[^;]*->middleware\('throttle:" "Payment registration no longer uses shared-IP throttle"
    Test-DoesNotContain $routes "(?s)Route::post\('/invoices/\{invoice\}/payments/\{payment\}/void'[^;]*->middleware\('throttle:" "Payment void no longer uses shared-IP throttle"
}

if ($test -ne "") {
    Test-Contains $test 'test_per_user_throttle_returns_429_with_safe_message' "Throttle safe 429 response is covered"
    Test-Contains $test 'test_per_user_throttle_does_not_block_another_cashier_on_same_lan_ip' "LAN same-IP isolation is covered"
    Test-Contains $test 'test_invoice_write_routes_use_per_user_throttle' "Critical write route middleware is covered"
    Test-Contains $test 'throttle\.user:60,1' "Test asserts 60/min per-user buckets"
    Test-Contains $test 'throttle\.user:30,1' "Test asserts 30/min per-user buckets"
}

if ($knownLimitations -ne "") {
    Test-Contains $knownLimitations 'Per-user rate limit guarded' "Known limitations records per-user rate limiting as closed"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Rate limit por usuario\*\*' "Known limitations no longer lists per-user rate limit as pending"
}

if ($operativeNotes -ne "") {
    Test-Contains $operativeNotes 'Rate limit por usuario[\s\S]*ThrottleByUser|ThrottleByUser[\s\S]*caja/pagos/facturas' "Operative notes record per-user rate limit status"
}

if ($handoff -ne "") {
    Test-Contains $handoff 'RATE_LIMIT_SAFETY_2026_06_03.md' "Handoff records rate-limit evidence"
    Test-Contains $handoff 'validate_rate_limit_safety.ps1' "Handoff records rate-limit guard"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "RATE_LIMIT_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "RATE_LIMIT_SAFETY: YES" -ForegroundColor Green
