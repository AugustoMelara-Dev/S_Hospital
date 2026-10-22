<?php

declare(strict_types=1);

/**
 * Worker process used by LegacyReprintRaceTest (T3-004).
 *
 * Boots a minimal Laravel context, waits for the shared race instant and
 * invokes App\Actions\Receipts\ReprintReceiptAction on a pre-provisioned
 * invoice. Each worker emits the durable counter and copy label reported by
 * the action, so the orchestrator can assert that the invoice row lock handed
 * out consecutive reprint numbers (#1 and #2) with no repeats nor gaps.
 *
 * The worker deliberately does NOT provision invoice, user or sequence: the
 * orchestrator creates all fixtures before the race so both processes only
 * contend on the invoice row lock.
 */

use App\Actions\Receipts\ReprintReceiptAction;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! app()->environment('testing')) {
    fwrite(STDERR, 'Worker expects APP_ENV=testing.'.PHP_EOL);
    exit(1);
}

$invoiceId = (int) getenv('HOSPITAL_REPRINT_INVOICE_ID');
$userId = (int) getenv('HOSPITAL_REPRINT_USER_ID');
$worker = trim((string) getenv('HOSPITAL_REPRINT_WORKER')) ?: 'a';
$startAt = (float) getenv('HOSPITAL_REPRINT_START_AT');

if ($invoiceId <= 0 || $userId <= 0) {
    fwrite(STDERR, 'HOSPITAL_REPRINT_INVOICE_ID and HOSPITAL_REPRINT_USER_ID are required.'.PHP_EOL);
    exit(1);
}

waitForRaceStart($startAt);

try {
    $invoice = Invoice::query()->findOrFail($invoiceId);
    $user = User::query()->findOrFail($userId);

    $result = $app->make(ReprintReceiptAction::class)->execute(
        $invoice,
        $user,
        'half_letter',
        "Reimpresion concurrente worker {$worker}",
    );

    echo json_encode([
        'worker' => $worker,
        'legacy_reprint_count' => $result['receipt']['legacy_reprint_count'] ?? null,
        'copy_label' => $result['receipt']['institutional']['copy_label'] ?? null,
        'audit_legacy_reprint_count' => $result['audit']['legacy_reprint_count'] ?? null,
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
    // instant so they hit the invoices row lock at the same time.
    while (microtime(true) < $startAt) {
        usleep(500);
    }
}
