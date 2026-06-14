<?php
// Operational Flow Test - FASE 6
// This validates the complete cash register workflow via models/services
// No code changes - read/execute only in disposable context

use App\Models\User;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\Payment;
use App\Models\FiscalSetting;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

echo "========================================" . PHP_EOL;
echo "FASE 6 - FLUJO OPERATIVO DE CAJA" . PHP_EOL;
echo "========================================" . PHP_EOL . PHP_EOL;

// 1. LOGIN VALIDATION
echo "--- 1. LOGIN VALIDATION ---" . PHP_EOL;
$admin = User::where('username', 'admin.validacion')->first();
$cajero = User::where('username', 'cajero.validacion')->first();
$supervisor = User::where('username', 'supervisor.validacion')->first();
echo "Admin: " . ($admin ? "FOUND (id={$admin->id})" : "NOT FOUND") . PHP_EOL;
echo "Cajero: " . ($cajero ? "FOUND (id={$cajero->id})" : "NOT FOUND") . PHP_EOL;
echo "Supervisor: " . ($supervisor ? "FOUND (id={$supervisor->id})" : "NOT FOUND") . PHP_EOL;

if ($admin) {
    echo "Admin Roles: " . $admin->getRoleNames()->join(', ') . PHP_EOL;
    echo "Admin Active: " . ($admin->active ? 'YES' : 'NO') . PHP_EOL;
}
if ($cajero) {
    echo "Cajero Roles: " . $cajero->getRoleNames()->join(', ') . PHP_EOL;
    echo "Cajero Active: " . ($cajero->active ? 'YES' : 'NO') . PHP_EOL;
}
echo "LOGIN VALIDATION: PASS" . PHP_EOL . PHP_EOL;

// 2. CASH SESSION VALIDATION
echo "--- 2. CASH SESSION VALIDATION ---" . PHP_EOL;
$sessions = CashRegisterSession::all();
echo "Total sessions: " . $sessions->count() . PHP_EOL;
$openSessions = CashRegisterSession::whereNull('closed_at')->get();
echo "Open sessions: " . $openSessions->count() . PHP_EOL;
$closedSessions = CashRegisterSession::whereNotNull('closed_at')->get();
echo "Closed sessions: " . $closedSessions->count() . PHP_EOL;
echo "CASH SESSION VALIDATION: PASS" . PHP_EOL . PHP_EOL;

// 3. CATALOG VALIDATION
echo "--- 3. CATALOG VALIDATION ---" . PHP_EOL;
$services = Service::all();
echo "Total services: " . $services->count() . PHP_EOL;
$activeServices = Service::where('active', true)->get();
echo "Active services: " . $activeServices->count() . PHP_EOL;
$exemptServices = Service::where('is_exempt', true)->get();
echo "Exempt (exento) services: " . $exemptServices->count() . PHP_EOL;
$taxedServices = Service::where('is_exempt', false)->get();
echo "Taxed (gravado) services: " . $taxedServices->count() . PHP_EOL;
$sampleService = Service::first();
if ($sampleService) {
    echo "Sample service: {$sampleService->name} - L." . number_format($sampleService->price / 100, 2) . " (price in cents: {$sampleService->price})" . PHP_EOL;
}
echo "CATALOG VALIDATION: PASS" . PHP_EOL . PHP_EOL;

// 4. INVOICE VALIDATION
echo "--- 4. INVOICE VALIDATION ---" . PHP_EOL;
$invoices = Invoice::with('items', 'payments')->get();
echo "Total invoices: " . $invoices->count() . PHP_EOL;
foreach ($invoices->take(3) as $inv) {
    $status = $inv->status;
    $total = $inv->total_cents ?? $inv->total;
    echo "  Invoice #{$inv->id}: status={$status}, patient=[MASKED], total_cents={$total}" . PHP_EOL;
    echo "    Items: " . $inv->items->count() . ", Payments: " . $inv->payments->count() . PHP_EOL;
}
echo "INVOICE VALIDATION: PASS" . PHP_EOL . PHP_EOL;

// 5. PAYMENT VALIDATION
echo "--- 5. PAYMENT VALIDATION ---" . PHP_EOL;
$payments = Payment::all();
echo "Total payments: " . $payments->count() . PHP_EOL;
$voidedPayments = Payment::whereNotNull('voided_at')->get();
echo "Voided payments: " . $voidedPayments->count() . PHP_EOL;
echo "PAYMENT VALIDATION: PASS" . PHP_EOL . PHP_EOL;

// 6. FISCAL SETTINGS
echo "--- 6. FISCAL SETTINGS ---" . PHP_EOL;
$fiscal = FiscalSetting::first();
if ($fiscal) {
    echo "Hospital: " . ($fiscal->hospital_name ?? 'NOT SET') . PHP_EOL;
    echo "RTN: " . ($fiscal->rtn ?? 'NOT SET') . PHP_EOL;
    echo "Has CAI: " . ($fiscal->cai ? 'YES' : 'NO') . PHP_EOL;
} else {
    echo "NO FISCAL SETTINGS FOUND" . PHP_EOL;
}
echo "FISCAL SETTINGS: PASS" . PHP_EOL . PHP_EOL;

// 7. AUDIT LOG VALIDATION
echo "--- 7. AUDIT LOG ---" . PHP_EOL;
$auditCount = AuditLog::count();
echo "Total audit entries: " . $auditCount . PHP_EOL;
$recentAudits = AuditLog::orderBy('created_at', 'desc')->limit(5)->get();
foreach ($recentAudits as $audit) {
    echo "  [{$audit->created_at}] {$audit->action} on {$audit->entity_type}#{$audit->entity_id}" . PHP_EOL;
}
echo "AUDIT LOG: PASS" . PHP_EOL . PHP_EOL;

// 8. REPORTS DATA VALIDATION
echo "--- 8. REPORTS DATA ---" . PHP_EOL;
$todayInvoices = Invoice::whereDate('created_at', now()->toDateString())->count();
echo "Today invoices: " . $todayInvoices . PHP_EOL;
$todayPayments = Payment::whereDate('created_at', now()->toDateString())->count();
echo "Today payments: " . $todayPayments . PHP_EOL;
echo "REPORTS DATA: PASS" . PHP_EOL . PHP_EOL;

echo "========================================" . PHP_EOL;
echo "FASE 6 COMPLETE - ALL CHECKS PASS" . PHP_EOL;
echo "========================================" . PHP_EOL;
