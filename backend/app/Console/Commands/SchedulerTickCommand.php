<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Records a scheduler tick so that SystemStatusController can report
 * how long ago the Laravel scheduler last ran. Called by the scheduler
 * sidecar (docker-compose.prod.yml scheduler service) and by the
 * Windows scheduled task (scripts/register_scheduler_cron.ps1).
 *
 * The tick is stored in two places for redundancy:
 *   - cache: 'hospital:scheduler:last_tick' = ISO-8601 timestamp
 *   - cache: 'hospital:scheduler:tick_history' = JSON array of the
 *     last 100 tick timestamps (rolling buffer)
 *
 * If MySQL is available we also write a row to the scheduler_ticks
 * table for long-term auditing.
 */
class SchedulerTickCommand extends Command
{
    protected $signature = 'hospital:scheduler-tick
        {--result=ok : ok or fail}
        {--message= : Optional human-readable message}';

    protected $description = 'Records a scheduler tick for the system status endpoint.';

    public function handle(): int
    {
        $now = now();
        $result = (string) $this->option('result');
        $message = (string) ($this->option('message') ?? '');

        // Cache layer (always available).
        Cache::put('hospital:scheduler:last_tick', $now->toIso8601String(), 86400);
        Cache::put('hospital:scheduler:last_result', $result, 86400);
        Cache::put('hospital:scheduler:last_message', $message, 86400);

        $history = Cache::get('hospital:scheduler:tick_history', []);
        if (! is_array($history)) {
            $history = [];
        }
        $history[] = [
            'at' => $now->toIso8601String(),
            'result' => $result,
            'message' => $message,
            'id' => (string) Str::uuid(),
        ];
        $history = array_slice($history, -100);
        Cache::put('hospital:scheduler:tick_history', $history, 7 * 86400);

        // Database layer (best-effort; skip if the table does not exist).
        try {
            if (DB::getSchemaBuilder()->hasTable('scheduler_ticks')) {
                DB::table('scheduler_ticks')->insert([
                    'at' => $now,
                    'result' => $result,
                    'message' => $message,
                    'created_at' => $now,
                ]);
            }
        } catch (\Throwable) {
            // Swallow: the tick has already been recorded in cache.
        }

        $this->info("Scheduler tick recorded: {$now->toIso8601String()} ({$result})");

        return self::SUCCESS;
    }
}
