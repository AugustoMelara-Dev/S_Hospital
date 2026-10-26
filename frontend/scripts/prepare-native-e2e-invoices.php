<?php

declare(strict_types=1);

// Synthetic F3 data only. Invoice, money and receipt snapshots use the real
// domain actions; the browser tests never supply their own calculated totals.
require __DIR__.'/../../backend/vendor/autoload.php';
$app = require __DIR__.'/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (! $app->environment('testing') || ! str_starts_with((string) config('database.connections.mysql.database'), 'sh_ai_f3_')) {
    throw new RuntimeException('F3 fixture requires testing and a disposable sh_ai_f3_* database.');
}
// Branding exercises an administrator payment without taking the cashier's
// pre-opened release session. Keep a dedicated synthetic register available.
App\Models\CashRegister::firstOrCreate(
    ['code' => 'QA_IDENTIDAD'],
    ['name' => 'Caja QA identidad', 'active' => true],
);
$cashier = App\Models\User::where('username', 'cajero.e2e')->firstOrFail();
$session = App\Models\CashRegisterSession::where('user_id', $cashier->id)->where('status', 'open')->firstOrFail();
$base = App\Models\Service::where('name', 'Glucosa')->firstOrFail();
$services = [];
foreach ([15, 18, 0] as $percentage) {
    $rate = $percentage === 0 ? null : App\Models\TaxRate::firstOrCreate(
        ['name' => 'F3 ISV '.$percentage],
        ['percentage' => $percentage.'.00', 'active' => true, 'is_default' => false],
    );
    $services[] = App\Models\Service::updateOrCreate(
        ['name' => 'F3 concepto '.$percentage],
        ['slug' => 'f3-concepto-'.$percentage, 'category_id' => $base->category_id, 'area_id' => $base->area_id,
            'price' => '100.00', 'taxable' => $percentage > 0, 'tax_rate_id' => $rate?->id,
            'active' => true, 'visible_in_billing' => true, 'is_billable' => true, 'print_on_receipt' => true],
    );
}
$create = $app->make(App\Actions\Billing\CreateInvoiceAction::class);
$register = $app->make(App\Actions\Payments\RegisterPaymentAction::class);
$issue = $app->make(App\Actions\InstitutionalReceipts\IssueInstitutionalReceiptAction::class);
$access = $app->make(App\Support\InvoiceAccess::class);
$count = App\Models\Invoice::where('patient_name', 'like', 'F3 H07 synthetic %')->count();
for ($index = $count + 1; $index <= 100; $index++) {
    $invoice = $create->execute(['patient_name' => 'F3 H07 synthetic '.$index,
        'items' => [['service_id' => $services[2]->id, 'quantity' => '1']]], $cashier);
    $payment = $register->execute($invoice, ['cash_session_id' => $session->id,
        'method' => 'cash', 'amount' => $invoice->total], $cashier, $access);
    $issue->execute(['invoice_id' => $invoice->id, 'payment_id' => $payment->id,
        'cash_session_id' => $session->id], $cashier, $access);
}
echo json_encode(['database' => config('database.connections.mysql.database'),
    'h07_invoice_count' => App\Models\Invoice::where('patient_name', 'like', 'F3 H07 synthetic %')->count(),
    'services' => array_map(fn ($service) => ['id' => $service->id, 'name' => $service->name], $services)], JSON_PRETTY_PRINT).PHP_EOL;
