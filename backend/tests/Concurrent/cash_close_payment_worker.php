<?php

declare(strict_types=1);

/**
 * Worker process used by CashSessionConcurrencyTest (M-W2-FIN-01) for the
 * close-vs-payment race.
 *
 * HOSPITAL_RACE_ROLE=close  -> CloseCashSessionAction on HOSPITAL_RACE_SESSION_ID
 * HOSPITAL_RACE_ROLE=pay    -> RegisterPaymentAction on HOSPITAL_RACE_INVOICE_ID
 *
 * Both actions lock the cash session row first, so the orchestrator can assert
 * that a posted payment never ends up attached to a closed session (no
 * impossible balance). Handled rejections exit 0 and are reported as JSON.
 */

use App\Actions\Cash\CloseCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Validation\ValidationException;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if (! app()->environment('testing')) {
    fwrite(STDERR, 'Worker expects APP_ENV=testing.'.PHP_EOL);
    exit(1);
}

$runId = trim((string) getenv('HOSPITAL_RACE_RUN_ID'));
$worker = trim((string) getenv('HOSPITAL_RACE_WORKER')) ?: 'a';
$role = trim((string) getenv('HOSPITAL_RACE_ROLE'));
$startAt = (float) getenv('HOSPITAL_RACE_START_AT');
$username = trim((string) getenv('HOSPITAL_RACE_USERNAME'));
$sessionId = (int) getenv('HOSPITAL_RACE_SESSION_ID');
$invoiceId = (int) getenv('HOSPITAL_RACE_INVOICE_ID');
$amount = trim((string) getenv('HOSPITAL_RACE_AMOUNT')) ?: '10.00';

if ($runId === '' || $username === '' || ! in_array($role, ['close', 'pay'], true)) {
    fwrite(STDERR, 'HOSPITAL_RACE_RUN_ID, HOSPITAL_RACE_USERNAME and HOSPITAL_RACE_ROLE=close|pay are required.'.PHP_EOL);
    exit(1);
}

waitForRaceStart($startAt);

$emit = static function (array $payload) use ($runId, $worker, $role): void {
    echo json_encode(array_merge(['run_id' => $runId, 'worker' => $worker, 'role' => $role], $payload), JSON_THROW_ON_ERROR).PHP_EOL;
};

try {
    $user = User::query()->where('username', $username)->firstOrFail();

    if ($role === 'close') {
        $session = CashRegisterSession::query()->findOrFail($sessionId);
        $closed = $app->make(CloseCashSessionAction::class)->execute(
            $session,
            ['closing_amount' => $amount, 'notes' => 'Carrera cierre contra cobro'],
            $user,
        );

        $emit([
            'outcome' => 'closed',
            'session_id' => $closed->id,
            'status' => $closed->status,
            'open_marker' => $closed->open_marker === null ? null : (int) $closed->open_marker,
        ]);
    } else {
        $invoice = Invoice::query()->findOrFail($invoiceId);
        $payment = $app->make(RegisterPaymentAction::class)->execute(
            $invoice,
            ['cash_session_id' => $sessionId, 'method' => Payment::METHOD_CASH, 'amount' => $amount],
            $user,
            $app->make(InvoiceAccess::class),
        );

        $emit([
            'outcome' => 'paid',
            'payment_id' => $payment->id,
            'amount' => (string) $payment->amount,
        ]);
    }
} catch (ValidationException $exception) {
    $emit(['outcome' => 'rejected', 'errors' => $exception->errors()]);
} catch (AuthorizationException $exception) {
    $emit(['outcome' => 'rejected', 'errors' => ['authorization' => [$exception->getMessage()]]]);
} catch (Throwable $exception) {
    fwrite(STDERR, get_class($exception).': '.$exception->getMessage().PHP_EOL);
    exit(1);
}

function waitForRaceStart(float $startAt): void
{
    if ($startAt <= 0.0) {
        return;
    }

    while (microtime(true) < $startAt) {
        usleep(500);
    }
}
