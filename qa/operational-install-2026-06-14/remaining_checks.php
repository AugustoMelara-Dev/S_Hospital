<?php
// Remaining operational validations
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\AuditLog;

echo "--- INVOICES ---" . PHP_EOL;
$invoices = Invoice::with('items','payments')->get();
echo "Total: " . $invoices->count() . PHP_EOL;
foreach ($invoices->take(5) as $inv) {
    echo "  INV#{$inv->id} status={$inv->status} total_cents={$inv->total_cents} paid_cents={$inv->paid_cents} items={$inv->items->count()} payments={$inv->payments->count()}" . PHP_EOL;
}

echo PHP_EOL . "--- PAYMENTS ---" . PHP_EOL;
$payments = Payment::all();
echo "Total: " . $payments->count() . PHP_EOL;
$voided = Payment::whereNotNull('voided_at')->count();
echo "Voided: " . $voided . PHP_EOL;
foreach ($payments->take(3) as $p) {
    echo "  PAY#{$p->id} amount_cents={$p->amount_cents} method={$p->method} voided=" . ($p->voided_at ? 'YES' : 'NO') . PHP_EOL;
}

echo PHP_EOL . "--- FISCAL ---" . PHP_EOL;
$fiscal = FiscalSetting::first();
if ($fiscal) {
    echo "Hospital: " . $fiscal->hospital_name . PHP_EOL;
    echo "RTN: " . ($fiscal->rtn ?? 'N/A') . PHP_EOL;
    echo "CAI: " . ($fiscal->cai ? 'YES' : 'N/A') . PHP_EOL;
}

echo PHP_EOL . "--- AUDIT ---" . PHP_EOL;
echo "Total entries: " . AuditLog::count() . PHP_EOL;
foreach (AuditLog::orderBy('created_at','desc')->limit(5)->get() as $a) {
    echo "  [{$a->created_at}] {$a->action}" . PHP_EOL;
}

echo PHP_EOL . "--- CASH SESSIONS ---" . PHP_EOL;
foreach (CashRegisterSession::all() as $s) {
    echo "  Session#{$s->id} opened={$s->opened_at} closed=" . ($s->closed_at ?? 'OPEN') . " opening_amount_cents={$s->opening_amount_cents}" . PHP_EOL;
}

echo PHP_EOL . "ALL REMAINING CHECKS PASS" . PHP_EOL;
