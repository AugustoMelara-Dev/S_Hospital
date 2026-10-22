<?php

declare(strict_types=1);

/**
 * Worker process used by FiscalNumberRaceTest.
 *
 * It boots a minimal Laravel context, waits for the shared race start
 * instant, opens the pre-provisioned cashier/session and emits one invoice
 * through App\Actions\Billing\CreateInvoiceAction. The orchestrator test
 * launches two instances concurrently and asserts both report distinct
 * fiscal correlatives.
 *
 * The worker deliberately does NOT create categories, services, users or
 * fiscal sequences: the orchestrator provisions all fixtures before the
 * race so both processes only contend on the fiscal sequence lock.
 */

use App\Actions\Billing\CreateInvoiceAction;
use App\Models\CashRegisterSession;
use App\Models\Service;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! app()->environment('testing')) {
    fwrite(STDERR, 'Worker expects APP_ENV=testing.'.PHP_EOL);
    exit(1);
}

$runId = trim((string) getenv('HOSPITAL_RACE_RUN_ID'));
$worker = trim((string) getenv('HOSPITAL_RACE_WORKER')) ?: 'a';
$startAt = (float) getenv('HOSPITAL_RACE_START_AT');

if ($runId === '') {
    fwrite(STDERR, 'HOSPITAL_RACE_RUN_ID is required.'.PHP_EOL);
    exit(1);
}

waitForRaceStart($startAt);

try {
    $username = "race-{$runId}-{$worker}";

    $cashier = User::query()->where('username', $username)->firstOrFail();

    $cashSession = CashRegisterSession::query()
        ->where('user_id', $cashier->id)
        ->where('status', CashRegisterSession::STATUS_OPEN)
        ->latest('opened_at')
        ->firstOrFail();

    $service = Service::query()->where('slug', "race-{$runId}")->firstOrFail();

    $action = $app->make(CreateInvoiceAction::class);
    $invoice = $action->execute(
        [
            'patient_name' => "Race {$runId} {$worker}",
            'items' => [
                ['service_id' => $service->id, 'quantity' => '1.00'],
            ],
        ],
        $cashier,
    );

    echo json_encode([
        'run_id' => $runId,
        'worker' => $worker,
        'cash_session_id' => $cashSession->id,
        'invoice_number' => $invoice->invoice_number,
        'total' => $invoice->total,
    ], JSON_THROW_ON_ERROR).PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, get_class($exception).': '.$exception->getMessage().PHP_EOL);
    exit(1);
}

function waitForRaceStart(float $startAt): void
{
    if ($startAt <= 0.0) {
        return;
    }

    // Shared wall-clock barrier: both workers busy-wait on the same future
    // instant so they hit the fiscal_sequences row lock at the same time.
    while (microtime(true) < $startAt) {
        usleep(500);
    }
}
