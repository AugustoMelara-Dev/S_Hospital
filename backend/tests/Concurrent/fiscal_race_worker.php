<?php

declare(strict_types=1);

/**
 * Worker process used by FiscalNumberRaceTest.
 *
 * It boots a minimal Laravel context, opens a cash session, and emits
 * one invoice. The orchestrator test launches two instances of this
 * script in parallel and asserts that both report distinct correlatives.
 */

use App\Actions\Billing\CreateInvoiceAction;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

ensureBaseline($app);

$runId = getenv('HOSPITAL_RACE_RUN_ID') ?: 'race-'.bin2hex(random_bytes(4));
$cashier = createCashier($runId);
$service = Service::query()->where('name', 'Glucosa')->firstOrFail();

$action = $app->make(CreateInvoiceAction::class);
$invoice = $action->execute(
    [
        'patient_name' => "Race {$runId}",
        'items' => [
            ['service_id' => $service->id, 'quantity' => '1.00'],
        ],
    ],
    $cashier,
);

echo json_encode([
    'run_id' => $runId,
    'invoice_number' => $invoice->invoice_number,
    'total' => $invoice->total,
]).PHP_EOL;

function ensureBaseline(Application $app): void
{
    if (! app()->environment('testing')) {
        fwrite(STDERR, 'Worker expects APP_ENV=testing.'.PHP_EOL);
        exit(1);
    }

    if (FiscalSetting::query()->doesntExist()) {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Race',
            'rtn' => '00000000000000',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
        ]);
    }

    if (FiscalSequence::query()->where('document_type', 'invoice')->doesntExist()) {
        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'RACE-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }
}

function createCashier(string $runId): User
{
    $username = 'race-'.substr($runId, 0, 8);

    $user = User::query()->where('username', $username)->first();
    if ($user === null) {
        $user = User::factory()->create([
            'username' => $username,
            'name' => "Race {$runId}",
            'email' => "{$username}@hospital.local",
            'must_change_password' => false,
            'active' => true,
        ]);
        $user->assignRole('cajero');
    }

    $existingSession = CashRegisterSession::query()
        ->where('user_id', $user->id)
        ->where('status', CashRegisterSession::STATUS_OPEN)
        ->latest('opened_at')
        ->first();

    if ($existingSession === null) {
        CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);
    }

    return $user;
}
