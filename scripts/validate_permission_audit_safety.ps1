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

$observer = Read-RequiredFile "backend\app\Observers\PermissionAuditObserver.php"
$provider = Read-RequiredFile "backend\app\Providers\AppServiceProvider.php"
$permissionConfig = Read-RequiredFile "backend\config\permission.php"
$test = Read-RequiredFile "backend\tests\Feature\PermissionAuditTest.php"
$userController = Read-RequiredFile "backend\app\Http\Controllers\UserController.php"
$knownLimitations = Read-RequiredFile "docs\KNOWN_LIMITATIONS.md"
$operativeNotes = Read-RequiredFile "docs\OPERATIVE_NOTES_2026_06_02.md"
$decisionLog = Read-RequiredFile "docs\DECISIONS.md"

if ($observer -ne "") {
    Test-Contains $observer 'class PermissionAuditObserver' "Permission audit observer exists"
    Test-Contains $observer 'rolesAttached' "Observer handles role attach events"
    Test-Contains $observer 'rolesDetached' "Observer handles role detach events"
    Test-Contains $observer 'permissionsAttached' "Observer handles permission attach events"
    Test-Contains $observer 'permissionsDetached' "Observer handles permission detach events"
    Test-Contains $observer 'AuditLog::query\(\)->create' "Observer writes audit_logs records"
    Test-Contains $observer "'role_name'\s*=>" "Observer records human role name"
    Test-Contains $observer "'permission_name'\s*=>" "Observer records human permission name"
    Test-Contains $observer 'currentUserId' "Observer records current operator when available"
    Test-Contains $observer 'catch \(\\Throwable\)' "Observer cannot break business flow"
    Test-DoesNotContain $observer 'Log::info|logger\(' "Observer does not downgrade permission audit to logs only"
    Test-DoesNotContain $observer '(?i)(password|remember_token|APP_KEY|DB_PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+' "Observer does not embed secret-like assignments"
}

if ($provider -ne "") {
    Test-Contains $provider 'registerPermissionAudit' "Provider registers permission audit wiring"
    Test-Contains $provider 'Role::observe\(\$observer\)' "Provider observes role model changes"
    Test-Contains $provider 'Permission::observe\(\$observer\)' "Provider observes permission model changes"
    Test-Contains $provider 'Event::listen\(RoleAttached::class' "Provider listens for role attach events"
    Test-Contains $provider 'Event::listen\(RoleDetached::class' "Provider listens for role detach events"
    Test-Contains $provider 'Event::listen\(PermissionAttached::class' "Provider listens for permission attach events"
    Test-Contains $provider 'Event::listen\(PermissionDetached::class' "Provider listens for permission detach events"
}

if ($permissionConfig -ne "") {
    Test-Contains $permissionConfig "'events_enabled'\s*=>\s*true" "Spatie permission events are enabled"
    Test-Contains $permissionConfig "'display_permission_in_exception'\s*=>\s*false" "Permission exception details stay hidden"
    Test-Contains $permissionConfig "'display_role_in_exception'\s*=>\s*false" "Role exception details stay hidden"
}

if ($test -ne "") {
    Test-Contains $test 'test_attaching_a_role_creates_an_audit_log_entry' "Role attach audit is covered by feature test"
    Test-Contains $test 'test_syncing_a_role_records_detach_and_attach_entries' "Role sync detach/attach audit is covered by feature test"
    Test-Contains $test 'test_creating_a_role_creates_an_audit_log_entry' "Role creation audit is covered by feature test"
    Test-Contains $test 'test_attaching_a_permission_to_a_role_creates_an_audit_log_entry' "Permission attach audit is covered by feature test"
    Test-Contains $test 'permission.attached' "Permission audit action is asserted"
    Test-Contains $test 'assertArrayNotHasKey\(' "Permission audit tests check payload omits sensitive fields"
}

if ($userController -ne "") {
    Test-Contains $userController 'if \(! \$user->hasRole\(\$validated\[''role''\]\)\)' "User updates avoid noisy role sync when unchanged"
    Test-Contains $userController '\$user->syncRoles\(\[\$validated\[''role''\]\]\)' "User updates still audit real role changes"
}

if ($knownLimitations -ne "") {
    Test-Contains $knownLimitations 'Permission audit guarded' "Known limitations records permission audit as closed"
    Test-DoesNotContain $knownLimitations '(?ms)### Pendientes para v1\.1.*\*\*Auditoria de cambios de permisos\*\*' "Known limitations no longer lists permission audit as pending"
}

if ($operativeNotes -ne "") {
    Test-Contains $operativeNotes 'Auditoria de roles y permisos[\s\S]*PermissionAuditObserver|PermissionAuditObserver[\s\S]*audit_logs' "Operative notes record permission audit status"
    Test-DoesNotContain $operativeNotes '(?ms)## Pendientes para v1\.1.*solo loguea a `Log::info`' "Operative notes no longer claim permission audit is log-only"
}

if ($decisionLog -ne "") {
    Test-Contains $decisionLog 'Auditoria de roles y permisos usa eventos Spatie' "Decision log records permission audit decision"
    Test-Contains $decisionLog 'PermissionAuditObserver' "Decision log records observer"
    Test-Contains $decisionLog 'audit_logs' "Decision log records durable audit target"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PERMISSION_AUDIT_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PERMISSION_AUDIT_SAFETY: YES" -ForegroundColor Green
