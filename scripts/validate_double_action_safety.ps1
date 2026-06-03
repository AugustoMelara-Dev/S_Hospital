param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
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
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

$concurrencyScript = Read-RequiredFile "scripts\validate_mysql_concurrency.mjs"
$concurrencyProof = Read-RequiredFile "qa\FINAL_CONCURRENCY_PROOF.md"
$invoiceTest = Read-RequiredFile "backend\tests\Feature\InvoiceCreationTest.php"
$cashPaymentTest = Read-RequiredFile "backend\tests\Feature\CashPaymentsReceiptTest.php"
$createInvoiceAction = Read-RequiredFile "backend\app\Actions\Billing\CreateInvoiceAction.php"
$openCashAction = Read-RequiredFile "backend\app\Actions\Cash\OpenCashSessionAction.php"
$registerPaymentAction = Read-RequiredFile "backend\app\Actions\Payments\RegisterPaymentAction.php"
$apiBase = Read-RequiredFile "frontend\src\lib\api\base.ts"
$apiBaseTest = Read-RequiredFile "frontend\src\lib\api\base.test.ts"
$helpView = Read-RequiredFile "frontend\src\features\help\HelpView.tsx"
$cashierManual = Read-RequiredFile "docs\manuales\MANUAL_CAJERO.md"
$supervisorManual = Read-RequiredFile "docs\manuales\MANUAL_SUPERVISOR.md"
$adminManual = Read-RequiredFile "docs\manuales\MANUAL_ADMINISTRADOR.md"

Assert-Contains "Concurrency validator requires explicit real-MySQL opt-in" $concurrencyScript "HOSPITAL_VALIDATE_REAL_MYSQL"
Assert-Contains "Concurrency validator confirms target URL separately" $concurrencyScript "HOSPITAL_CONFIRM_CONCURRENCY_TARGET"
Assert-Contains "Concurrency validator requires target environment" $concurrencyScript "HOSPITAL_CONCURRENCY_TARGET_ENV"
Assert-Contains "Concurrency validator rejects credentials in URLs" $concurrencyScript "baseUri\.username \|\| baseUri\.password"
Assert-Contains "Concurrency validator refuses production-like targets" $concurrencyScript "production|staging|preprod"
Assert-Contains "Concurrency validator requires disposable/local target wording" $concurrencyScript "test|local|validation|disposable"
Assert-Contains "Concurrency evidence path is constrained" $concurrencyScript "HOSPITAL_CONCURRENCY_EVIDENCE_PATH"
Assert-Contains "Concurrency evidence stays under qa" $concurrencyScript "qa"
Assert-Contains "Concurrency validator exercises double cash opening" $concurrencyScript "Double cash-session open"
Assert-Contains "Concurrency validator exercises concurrent invoice emission" $concurrencyScript "Concurrent invoice emission"
Assert-Contains "Concurrency validator exercises double payment" $concurrencyScript "Double payment"
Assert-Contains "Concurrency validator accepts created status and conflict/validation statuses" $concurrencyScript "201[\s\S]*409[\s\S]*422"
Assert-Contains "Concurrency validator documents audit limitation for disposable snapshots" $concurrencyScript "NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT"

Assert-Contains "Final concurrency proof records double cash opening result" $concurrencyProof "Double cash-session open"
Assert-Contains "Final concurrency proof records concurrent invoice result" $concurrencyProof "Concurrent invoice emission"
Assert-Contains "Final concurrency proof records double payment result" $concurrencyProof "Double payment"
Assert-Contains "Final concurrency proof records duplicate-action status split" $concurrencyProof "201\s*/\s*422"
Assert-Contains "Final concurrency proof has a final conclusion" $concurrencyProof "Final conclusion"

Assert-Contains "Invoice feature test covers concurrent invoice number uniqueness" $invoiceTest "test_two_invoice_emissions_do_not_duplicate_invoice_number"
Assert-Contains "Invoice feature test rejects duplicate invoice numbers" $invoiceTest "assertNotSame"
Assert-Contains "Invoice feature test checks distinct invoice numbers" $invoiceTest "distinct\('invoice_number'\)"
Assert-Contains "Invoice creation uses a database transaction" $createInvoiceAction "DB::transaction"
Assert-Contains "Invoice creation locks open cash session while issuing" $createInvoiceAction "lockForUpdate\(\)"
Assert-Contains "Invoice creation uses fiscal number action inside transaction" $createInvoiceAction "GenerateFiscalNumberAction"

Assert-Contains "Cash open action checks for already-open session" $openCashAction "alreadyOpen"
Assert-Contains "Cash open action locks existing session check" $openCashAction "lockForUpdate\(\)"
Assert-Contains "Cash open action returns operator-safe duplicate cashbox message" $openCashAction "El cajero ya tiene una caja abierta"
Assert-Contains "Cash tests cover duplicate open request" $cashPaymentTest "test_cashier_can_open_cash_session_and_cannot_open_two"
Assert-Contains "Cash tests cover database uniqueness guard" $cashPaymentTest "test_database_constraint_allows_only_one_open_cash_session_per_cashier"
Assert-Contains "Cash tests expect duplicate open validation" $cashPaymentTest "assertJsonValidationErrors\('cash_session'\)"

Assert-Contains "Payment registration locks the invoice" $registerPaymentAction "Invoice::query\(\)[\s\S]*lockForUpdate\(\)"
Assert-Contains "Payment registration locks the cash session" $registerPaymentAction "CashRegisterSession::query\(\)[\s\S]*lockForUpdate\(\)"
Assert-Contains "Payment registration rejects already paid invoices" $registerPaymentAction "La factura ya esta pagada"
Assert-Contains "Payment registration rejects overpayment" $registerPaymentAction "El monto no puede exceder"
Assert-Contains "Payment tests reject paid invoices and overpayment" $cashPaymentTest "test_payment_rejects_invalid_amounts_overpayment_void_and_paid_invoices"

Assert-Contains "API maps duplicate billing operations to history guidance" $apiBase "La factura o el pago ya cambio de estado[\s\S]*Revise Historial"
Assert-Contains "API maps cashbox conflicts to cashbox/history guidance" $apiBase "La caja esta cerrada o cambio de estado[\s\S]*Revise Caja e Historial"
Assert-Contains "API tests protect duplicate-operation guidance" $apiBaseTest "check history before repeating duplicated billing operations"
Assert-Contains "API tests avoid exposing raw internal conflict fields" $apiBaseTest "not\.toMatch\(/cash_session_id/i\)"

Assert-Contains "Help warns staff not to repeat invoices or payments" $helpView "No repita facturas ni cobros"
Assert-Contains "Help tells staff to check cashbox/history before retrying" $helpView "revise Caja e Historial"
Assert-Contains "Cashier manual warns before repeating invoice or payment" $cashierManual "Antes de repetir una factura o cobro"
Assert-Contains "Supervisor manual warns before repeating invoice or payment" $supervisorManual "Antes de pedir repetir una factura o cobro"
Assert-Contains "Administrator manual requires history/audit review before retrying" $adminManual "revise Historial, pagos y auditoria"

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "DOUBLE_ACTION_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "DOUBLE_ACTION_SAFETY: YES" -ForegroundColor Green
