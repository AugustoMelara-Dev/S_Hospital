<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneOperationalLogsCommand extends Command
{
    protected $signature = 'hospital:prune-operational-logs
        {--login-days=30 : Keep login attempts newer than this many days}
        {--client-error-days=90 : Keep browser error logs newer than this many days}
        {--chunk=1000 : Maximum rows deleted per batch}
        {--dry-run : Report the number of rows that would be deleted without removing them}';

    protected $description = 'Delete expired login attempts and browser error diagnostics in bounded batches.';

    public function handle(): int
    {
        $loginDays = (int) $this->option('login-days');
        $clientErrorDays = (int) $this->option('client-error-days');
        $chunk = min(5000, max(1, (int) $this->option('chunk')));

        if ($loginDays < 1 || $clientErrorDays < 7) {
            $this->error('Login retention must be at least 1 day and client error retention at least 7 days.');

            return self::INVALID;
        }

        $loginCutoff = now()->subDays($loginDays);
        $clientErrorCutoff = now()->subDays($clientErrorDays);
        $loginCount = DB::table('login_attempts')->where('attempted_at', '<', $loginCutoff)->count();
        $clientErrorCount = DB::table('client_error_logs')->where('occurred_at', '<', $clientErrorCutoff)->count();

        if ($this->option('dry-run')) {
            $this->info(sprintf(
                'Se eliminarian login_attempts=%d y client_error_logs=%d.',
                $loginCount,
                $clientErrorCount,
            ));

            return self::SUCCESS;
        }

        $deletedLogins = $this->deleteInChunks('login_attempts', 'attempted_at', $loginCutoff, $chunk);
        $deletedClientErrors = $this->deleteInChunks('client_error_logs', 'occurred_at', $clientErrorCutoff, $chunk);

        $this->info(sprintf(
            'Poda operativa completada: login_attempts=%d, client_error_logs=%d.',
            $deletedLogins,
            $deletedClientErrors,
        ));

        return self::SUCCESS;
    }

    private function deleteInChunks(
        string $table,
        string $dateColumn,
        \DateTimeInterface $cutoff,
        int $chunk,
    ): int {
        $deleted = 0;

        do {
            $ids = DB::table($table)
                ->where($dateColumn, '<', $cutoff)
                ->orderBy('id')
                ->limit($chunk)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += DB::table($table)
                ->whereIn('id', $ids)
                ->delete();
        } while ($ids->count() === $chunk);

        return $deleted;
    }
}
