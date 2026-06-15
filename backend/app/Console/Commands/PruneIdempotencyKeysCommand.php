<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PruneIdempotencyKeysCommand extends Command
{
    protected $signature = 'hospital:prune-idempotency-keys
        {--days=30 : Edad minima en dias para eliminar llaves antiguas}
        {--chunk=500 : Cantidad maxima por lote}
        {--dry-run : Reportar sin borrar registros}';

    protected $description = 'Pruna llaves de idempotencia antiguas sin afectar reintentos recientes.';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $chunk = min(5000, max(1, (int) $this->option('chunk')));
        $dryRun = (bool) $this->option('dry-run');
        $cutoff = now()->subDays($days);

        $legacyCount = $this->countLegacyKeys($cutoff);
        $operationCount = $this->countOperationKeys($cutoff);

        $this->components->info(sprintf(
            'Llaves candidatas antes de %s: legacy=%d, operational=%d.',
            $cutoff->toDateTimeString(),
            $legacyCount,
            $operationCount,
        ));

        if ($dryRun) {
            $this->components->warn('Dry-run activo: no se borro ningun registro.');

            return self::SUCCESS;
        }

        $deletedLegacy = $this->deleteInChunks('idempotency_keys', $this->legacyScope(...), $cutoff, $chunk);
        $deletedOperation = $this->deleteInChunks('operation_idempotency_keys', $this->operationScope(...), $cutoff, $chunk);

        $this->components->info(sprintf(
            'Prune completado: legacy=%d, operational=%d.',
            $deletedLegacy,
            $deletedOperation,
        ));

        return self::SUCCESS;
    }

    private function countLegacyKeys(\DateTimeInterface $cutoff): int
    {
        if (! Schema::hasTable('idempotency_keys')) {
            return 0;
        }

        return $this->legacyScope(DB::table('idempotency_keys'), $cutoff)->count();
    }

    private function countOperationKeys(\DateTimeInterface $cutoff): int
    {
        if (! Schema::hasTable('operation_idempotency_keys')) {
            return 0;
        }

        return $this->operationScope(DB::table('operation_idempotency_keys'), $cutoff)->count();
    }

    private function legacyScope(Builder $query, \DateTimeInterface $cutoff): Builder
    {
        return $query->where(function (Builder $scope) use ($cutoff): void {
            $scope->where('completed_at', '<', $cutoff)
                ->orWhere(function (Builder $pending) use ($cutoff): void {
                    $pending->whereNull('completed_at')
                        ->where('updated_at', '<', $cutoff);
                });
        });
    }

    private function operationScope(Builder $query, \DateTimeInterface $cutoff): Builder
    {
        return $query->where('updated_at', '<', $cutoff);
    }

    /**
     * @param  callable(Builder, \DateTimeInterface): Builder  $scope
     */
    private function deleteInChunks(string $table, callable $scope, \DateTimeInterface $cutoff, int $chunk): int
    {
        if (! Schema::hasTable($table)) {
            return 0;
        }

        $deleted = 0;

        do {
            $ids = $scope(DB::table($table), $cutoff)
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
