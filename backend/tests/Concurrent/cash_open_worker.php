<?php

declare(strict_types=1);

/**
 * Worker process used by CashSessionConcurrencyTest (M-W2-FIN-01).
 *
 * Boots a minimal Laravel context, waits for the shared race start instant and
 * calls App\Actions\Cash\OpenCashSessionAction for the user/register named by
 * the orchestrator. The orchestrator launches independent PHP CLI processes so
 * the GET_LOCK + row lock + unique index contention is real (the in-memory
 * SQLite suite shares a single connection and cannot reproduce it).
 *
 * Outcomes are always reported as JSON on stdout:
 *   { outcome: "opened"|"rejected", ... }
 * A handled validation rejection exits 0; an unexpected failure exits 1.
 */

use App\Actions\Cash\OpenCashSessionAction;
use App\Models\CashRegister;
use App\Models\User;
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
$startAt = (float) getenv('HOSPITAL_RACE_START_AT');
$username = trim((string) getenv('HOSPITAL_RACE_USERNAME'));
$registerCode = trim((string) getenv('HOSPITAL_RACE_REGISTER_CODE')) ?: 'principal';

if ($runId === '' || $username === '') {
    fwrite(STDERR, 'HOSPITAL_RACE_RUN_ID and HOSPITAL_RACE_USERNAME are required.'.PHP_EOL);
    exit(1);
}

waitForRaceStart($startAt);

$emit = static function (array $payload) use ($runId, $worker): void {
    echo json_encode(array_merge(['run_id' => $runId, 'worker' => $worker], $payload), JSON_THROW_ON_ERROR).PHP_EOL;
};

try {
    $user = User::query()->where('username', $username)->firstOrFail();

    $registerId = (int) CashRegister::query()->where('code', $registerCode)->value('id');
    if ($registerId <= 0) {
        throw new RuntimeException("Cash register '{$registerCode}' was not provisioned.");
    }

    $session = $app->make(OpenCashSessionAction::class)->execute(
        ['opening_amount' => '100.00', 'cash_register_id' => $registerId],
        $user,
    );

    $emit([
        'outcome' => 'opened',
        'session_id' => $session->id,
        'cash_register_id' => (int) $session->cash_register_id,
        'open_marker' => $session->open_marker === null ? null : (int) $session->open_marker,
    ]);
} catch (ValidationException $exception) {
    $emit([
        'outcome' => 'rejected',
        'resolved_register_code' => $registerCode ?? null,
        'resolved_register_id' => $registerId ?? null,
        'errors' => $exception->errors(),
    ]);
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
    // instant so they hit the register lock at the same time.
    while (microtime(true) < $startAt) {
        usleep(500);
    }
}
