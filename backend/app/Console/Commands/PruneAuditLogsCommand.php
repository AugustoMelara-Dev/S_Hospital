<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneAuditLogsCommand extends Command
{
    protected $signature = 'hospital:prune-audit-logs
        {--days=365 : Keep audit logs newer than this many days}
        {--dry-run : Report the number of rows that would be deleted without removing them}';

    protected $description = 'Delete audit_logs older than the configured retention window to keep the table small.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        if ($days < 30) {
            $this->error('Retention must be at least 30 days to keep a meaningful audit trail.');

            return self::INVALID;
        }

        $cutoff = now()->subDays($days);
        $query = DB::table('audit_logs')->where('created_at', '<', $cutoff);

        $count = (clone $query)->count();

        if ($this->option('dry-run')) {
            $this->info(sprintf('Se eliminarian %d filas de audit_logs anteriores a %s.', $count, $cutoff->toIso8601String()));

            return self::SUCCESS;
        }

        if ($count === 0) {
            $this->info('No hay audit_logs anteriores al cutoff; nada que podar.');

            return self::SUCCESS;
        }

        $deleted = $query->delete();
        $this->info(sprintf('Podadas %d filas de audit_logs anteriores a %s.', $deleted, $cutoff->toIso8601String()));

        return self::SUCCESS;
    }
}
