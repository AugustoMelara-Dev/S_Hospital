<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\AuditAdmin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneAuditLogsCommand extends Command
{
    protected $signature = 'hospital:prune-audit-logs
        {--days=365 : Keep audit logs newer than this many days}
        {--chunk=1000 : Maximum rows deleted per batch}
        {--dry-run : Report the number of rows that would be deleted without removing them}';

    protected $description = 'Delete audit_logs older than the configured retention window to keep the table small.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $chunk = min(5000, max(1, (int) $this->option('chunk')));
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

        $deleted = AuditAdmin::run(fn (): int => $this->deleteInChunks($cutoff, $chunk));
        $this->info(sprintf('Podadas %d filas de audit_logs anteriores a %s.', $deleted, $cutoff->toIso8601String()));

        return self::SUCCESS;
    }

    private function deleteInChunks(\DateTimeInterface $cutoff, int $chunk): int
    {
        $deleted = 0;

        do {
            $ids = DB::table('audit_logs')
                ->where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit($chunk)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += DB::table('audit_logs')
                ->whereIn('id', $ids)
                ->delete();
        } while ($ids->count() === $chunk);

        return $deleted;
    }
}
