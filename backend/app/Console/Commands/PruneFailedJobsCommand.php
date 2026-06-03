<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneFailedJobsCommand extends Command
{
    protected $signature = 'hospital:prune-failed-jobs
        {--days=30 : Keep failed_jobs rows newer than this many days}
        {--dry-run : Report the number of rows that would be deleted without removing them}';

    protected $description = 'Delete failed_jobs rows older than the configured retention window.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 1) {
            $this->error('Retention must be at least 1 day to keep the diagnostic trail.');

            return self::INVALID;
        }

        $cutoff = now()->subDays($days);
        $query = DB::table('failed_jobs')->where('failed_at', '<', $cutoff);

        $count = (clone $query)->count();

        if ($this->option('dry-run')) {
            $this->info(sprintf('Se eliminarian %d filas de failed_jobs anteriores a %s.', $count, $cutoff->toIso8601String()));

            return self::SUCCESS;
        }

        if ($count === 0) {
            $this->info('No hay failed_jobs anteriores al cutoff; nada que podar.');

            return self::SUCCESS;
        }

        $deleted = $query->delete();
        $this->info(sprintf('Podadas %d filas de failed_jobs anteriores a %s.', $deleted, $cutoff->toIso8601String()));

        return self::SUCCESS;
    }
}
