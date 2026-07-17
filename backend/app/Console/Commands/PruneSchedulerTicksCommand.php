<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneSchedulerTicksCommand extends Command
{
    protected $signature = 'hospital:prune-scheduler-ticks
        {--days=7 : Keep scheduler heartbeat rows newer than this many days}
        {--chunk=1000 : Maximum rows deleted per batch}
        {--dry-run : Report the number of rows that would be deleted without removing them}';

    protected $description = 'Delete old scheduler heartbeat rows while retaining recent operational evidence.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $chunk = min(5000, max(1, (int) $this->option('chunk')));

        if ($days < 2) {
            $this->error('Retention must be at least 2 days to preserve recent scheduler evidence.');

            return self::INVALID;
        }

        $cutoff = now()->subDays($days);
        $count = DB::table('scheduler_ticks')->where('at', '<', $cutoff)->count();

        if ($this->option('dry-run')) {
            $this->info(sprintf('Se eliminarian %d scheduler_ticks anteriores a %s.', $count, $cutoff->toIso8601String()));

            return self::SUCCESS;
        }

        $deleted = $this->deleteInChunks($cutoff, $chunk);
        $this->info(sprintf('Podados %d scheduler_ticks anteriores a %s.', $deleted, $cutoff->toIso8601String()));

        return self::SUCCESS;
    }

    private function deleteInChunks(\DateTimeInterface $cutoff, int $chunk): int
    {
        $deleted = 0;

        do {
            $ids = DB::table('scheduler_ticks')
                ->where('at', '<', $cutoff)
                ->orderBy('id')
                ->limit($chunk)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += DB::table('scheduler_ticks')
                ->whereIn('id', $ids)
                ->delete();
        } while ($ids->count() === $chunk);

        return $deleted;
    }
}
