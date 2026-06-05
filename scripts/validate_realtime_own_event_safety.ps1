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

function Protect-RealtimeGuardText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD|HOSPITAL_LICENSE_SALT)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-RealtimeGuardText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-RealtimeGuardText $message)" -ForegroundColor Green
}

function Read-RequiredText([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Test-Content([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Test-ContainsLiteral([string] $content, [string] $needle, [string] $label) {
    if ($content.Contains($needle)) {
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

function Test-EventClassActorPayload([string] $relativePath, [string] $channel, [string] $eventName, [string] $label) {
    $content = Read-RequiredText $relativePath
    if ($content -eq "") {
        return
    }

    Test-Content $content 'public readonly \?int \$actorId = null' "$label accepts optional actor id"
    Test-ContainsLiteral $content "'actor_id' => `$this->actorId" "$label broadcasts actor_id"
    Test-Content $content ([regex]::Escape("new Channel('$channel')")) "$label keeps expected channel $channel"
    Test-Content $content ([regex]::Escape("return '$eventName';")) "$label keeps expected event name $eventName"
}

$syncHook = Read-RequiredText "frontend\src\lib\realtime\useBroadcastSync.ts"
$syncTest = Read-RequiredText "frontend\src\lib\realtime\useBroadcastSync.test.ts"
$sessionCache = Read-RequiredText "frontend\src\lib\realtime\session.ts"
$types = Read-RequiredText "frontend\src\lib\realtime\types.ts"
$appShell = Read-RequiredText "frontend\src\layout\AppShell.tsx"
$broadcastingTest = Read-RequiredText "backend\tests\Feature\BroadcastingWiringTest.php"
$runbook = Read-RequiredText "docs\manuales\RUNBOOK_INCIDENTES_COMUNES.md"
$evidence = Read-RequiredText "qa\REALTIME_OWN_EVENT_SAFETY_2026_06_04.md"

Test-EventClassActorPayload "backend\app\Events\InvoiceChanged.php" "invoices" "invoice.changed" "InvoiceChanged"
Test-EventClassActorPayload "backend\app\Events\PaymentChanged.php" "payments" "payment.changed" "PaymentChanged"
Test-EventClassActorPayload "backend\app\Events\CashSessionChanged.php" "cash" "cash-session.changed" "CashSessionChanged"

if ($broadcastingTest -ne "") {
    Test-ContainsLiteral $broadcastingTest '$this->assertSame(123, $payload[''actor_id'']);' "Backend test asserts invoice actor_id"
    Test-ContainsLiteral $broadcastingTest '$this->assertSame(456, $event->broadcastWith()[''actor_id'']);' "Backend test asserts payment actor_id"
    Test-ContainsLiteral $broadcastingTest '$this->assertSame(789, $event->broadcastWith()[''actor_id'']);' "Backend test asserts cash actor_id"
    Test-Content $broadcastingTest '\$e->actorId\s*===\s*\$cashier->id' "Backend test proves invoice creation carries actor id"
}

if ($sessionCache -ne "") {
    Test-Content $sessionCache 'let currentUserId: number \| null = null' "Session cache starts without user"
    Test-Content $sessionCache 'setStoredUserId\(userId: number \| null\)' "Session cache supports login/logout updates"
    Test-Content $sessionCache 'getStoredUserId\(\): number \| null' "Session cache exposes current user id"
}

if ($types -ne "") {
    $actorTypeMatches = [regex]::Matches($types, 'actor_id\?: number \| null')
    if ($actorTypeMatches.Count -ge 3) {
        Add-Pass "Frontend realtime event types keep optional actor_id for invoice, payment and cash"
    } else {
        Add-Failure "Frontend realtime event types must keep optional actor_id on invoice, payment and cash payloads."
    }
}

if ($syncHook -ne "") {
    Test-Content $syncHook "import \{ getStoredUserId \} from './session'" "useBroadcastSync reads current user at event time"
    Test-Content $syncHook 'function isOwnEvent\(actorId: number \| null \| undefined, currentUserId: number \| null\)' "useBroadcastSync has own-event comparison helper"
    Test-Content $syncHook 'return actorId === currentUserId' "Own-event helper compares actor id with current user id"
    Test-Content $syncHook 'function shouldNotifyBroadcast\(actorId: number \| null \| undefined\)' "useBroadcastSync has notification decision helper"
    Test-Content $syncHook '!isOwnEvent\(actorId, getStoredUserId\(\)\)' "Notification helper reads stored user dynamically"
    Test-Content $syncHook '(?s)const onInvoice.*?invalidateQueries.*?invalidateQueries.*?if \(!shouldNotifyBroadcast\(payload\.actor_id\)\)' "Invoice handler invalidates before suppressing own toast"
    Test-Content $syncHook '(?s)const onPayment.*?invalidateQueries.*?invalidateQueries.*?invalidateQueries.*?if \(!shouldNotifyBroadcast\(payload\.actor_id\)\)' "Payment handler invalidates before suppressing own toast"
    Test-Content $syncHook '(?s)const onCash.*?invalidateQueries.*?if \(!shouldNotifyBroadcast\(payload\.actor_id\)\)' "Cash handler invalidates before suppressing own toast"
}

if ($syncTest -ne "") {
    Test-Content $syncTest 'suppresses notifications for the current user at event time' "Frontend test covers dynamic current-user changes"
    Test-Content $syncTest 'keeps notifications for legacy events without actor id' "Frontend test keeps legacy events visible"
    Test-Content $syncTest 'expect\(__test__shouldNotifyBroadcast\(7\)\)\.toBe\(false\)' "Frontend test suppresses own actor id"
    Test-Content $syncTest 'expect\(__test__shouldNotifyBroadcast\(undefined\)\)\.toBe\(true\)' "Frontend test notifies when actor id missing"
}

if ($appShell -ne "") {
    Test-Content $appShell "import \{ useBroadcastSync \} from '../lib/realtime/useBroadcastSync'" "AppShell imports broadcast sync"
    Test-Content $appShell 'useBroadcastSync\(\)' "AppShell mounts broadcast sync once"
}

$combinedDocs = "$runbook`n$evidence"
if ($combinedDocs -ne "") {
    Test-Content $combinedDocs 'actor_id' "Docs/evidence mention actor_id"
    Test-Content $combinedDocs 'Reduce repeated operator notifications|descarta eventos|descarta notificaciones' "Docs/evidence explain own-event suppression"
    Test-Content $combinedDocs 'final LAN validation|segunda PC|segundo.*PC|LAN validation' "Docs/evidence keep final LAN proof separate"
}

$allSource = "$syncHook`n$syncTest`n$sessionCache`n$types`n$broadcastingTest`n$combinedDocs"
Test-DoesNotContain $allSource '(?i)APP_KEY\s*[:=]\s*[^\s`]+' "Realtime own-event evidence does not expose APP_KEY"
Test-DoesNotContain $allSource '(?i)DB_PASSWORD\s*[:=]\s*[^\s`]+' "Realtime own-event evidence does not expose DB_PASSWORD"
Test-DoesNotContain $allSource '(?i)(TOKEN|SECRET|MAIL_PASSWORD|HOSPITAL_LICENSE_SALT)\s*[:=]\s*[^\s`]+' "Realtime own-event evidence does not expose secret-like values"

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "REALTIME_OWN_EVENT_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "REALTIME_OWN_EVENT_SAFETY: YES" -ForegroundColor Green
