<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Billing\GenerateFiscalNumberAction;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\FiscalSequence;
use App\Support\RestoreReconciliation;
use App\Support\RestoreReconciliationManifest;
use App\Support\RestoreReconciliationPendingException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

/**
 * M-W1-BK-01: frontera entre la copia externa cifrada (dominio hs-backups) y
 * la regla de correlativos post-restore (HS-RESTORE-SEQUENCE, hs-finance).
 *
 * Regla verificada: reanudar la emision exige una copia externa `verified`
 * vigente en el ledger `backup_external_copies`. Si esa copia se degrada
 * (por ejemplo, el guard del destino falla y ExternalBackupCopyAction la pasa a
 * `failed`), la reconciliacion se rechaza y la emision de correlativos sigue
 * bloqueada: no se puede "reconciliar" contra evidencia externa invalida.
 */
class BackupSequenceReconciliationBoundaryTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $tempFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }

        parent::tearDown();
    }

    public function test_verified_external_copy_lets_reconciliation_advance_the_sequence(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);
        $manifest = $this->writeManifest($this->verifiedCopy(sha256: $this->hash('verified-copy')), 10);

        app(RestoreReconciliation::class)->start('Restore de copia externa verificada 2026-09-10', 'hs-recovery');

        $result = app(RestoreReconciliation::class)->confirm(
            $manifest['path'],
            RestoreReconciliation::CONFIRM_PHRASE,
            'Jefatura de finanzas autoriza reconciliar el restore',
            'Dra. Supervisora Finanzas',
        );

        $this->assertSame('confirmed', $result['status']);
        $this->assertSame('verified', $result['ledger_verification']['status']);
        $this->assertSame(10, $sequence->fresh()->current_number);
        $this->assertFalse(app(RestoreReconciliation::class)->isPending());

        // La emision se reanuda exactamente despues del maximo reconciliado.
        $next = app(GenerateFiscalNumberAction::class)->execute();
        $this->assertSame(11, $next['next_number']);
    }

    public function test_degraded_external_copy_keeps_reconciliation_rejected_and_emission_blocked(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);

        // La copia externa fue degradada a `failed` (p. ej. guard de destino
        // roto tras la verificacion): deja de ser evidencia recuperable.
        $copy = $this->degradedCopy();
        $manifest = $this->writeManifest($copy, 10);

        $reconciliation = app(RestoreReconciliation::class);
        $reconciliation->start('Restore de copia externa degradada 2026-09-10', 'hs-recovery');

        try {
            $reconciliation->confirm(
                $manifest['path'],
                RestoreReconciliation::CONFIRM_PHRASE,
                'Intento de reconciliar con copia externa degradada',
                'Supervisor Finanzas',
            );
            $this->fail('La reconciliacion debio rechazarse con una copia externa no verificada.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('verified', $exception->getMessage());
        }

        // El bloqueo permanece y ningun correlativo se movio.
        $this->assertTrue($reconciliation->isPending());
        $this->assertSame(5, $sequence->fresh()->current_number);
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
        $this->assertSame(1, AuditLog::query()->where('action', 'restore_reconciliation.confirmation_rejected')->count());

        try {
            app(GenerateFiscalNumberAction::class)->execute();
            $this->fail('La emision debio seguir bloqueada con reconciliacion pendiente.');
        } catch (RestoreReconciliationPendingException) {
            // fail-closed esperado
        }

        $this->assertSame(5, $sequence->fresh()->current_number);
    }

    private function createActiveInvoiceSequence(int $currentNumber): FiscalSequence
    {
        return FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => $currentNumber,
            'cai' => 'CAI-BOUNDARY-'.bin2hex(random_bytes(4)),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    /**
     * @return array{id: int, backup_id: int, sha256: string}
     */
    private function verifiedCopy(string $sha256): array
    {
        return $this->createCopy($sha256, 'verified');
    }

    /**
     * Copia degradada por guard/destino invalido: conserva sha/bytes historicos
     * pero ya no es `verified`.
     *
     * @return array{id: int, backup_id: int, sha256: string}
     */
    private function degradedCopy(): array
    {
        return $this->createCopy($this->hash('degraded-copy'), 'failed');
    }

    /**
     * @return array{id: int, backup_id: int, sha256: string}
     */
    private function createCopy(string $sha256, string $status): array
    {
        $backup = BackupLog::query()->create([
            'filename' => 'boundary-'.bin2hex(random_bytes(4)).'.sql.gz.enc',
            'path' => 'backups/boundary-'.bin2hex(random_bytes(4)).'.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 2048,
            'checksum_sha256' => $sha256,
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'completed_at' => now(),
        ]);

        $copyId = (int) DB::table('backup_external_copies')->insertGetId([
            'backup_log_id' => $backup->id,
            'destination_label' => 'USB-HOSPITAL-1',
            'relative_path' => 'hospital-backups/boundary.sql.gz.enc',
            'sha256' => $sha256,
            'bytes' => 2048,
            'status' => $status,
            'copied_at' => now(),
            'verified_at' => $status === 'verified' ? now() : null,
            'failed_at' => $status === 'failed' ? now() : null,
            'error_message' => $status === 'failed' ? 'Destino externo no valido (prueba).' : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return ['id' => $copyId, 'backup_id' => $backup->id, 'sha256' => $sha256];
    }

    /**
     * Manifiesto externo valido (hash canonico de produccion).
     *
     * @param  array{id: int, backup_id: int, sha256: string}  $copy
     * @return array{path: string}
     */
    private function writeManifest(array $copy, int $maxInvoice): array
    {
        $payload = [
            'schema_version' => 1,
            'generated_at' => '2026-09-13T20:00:00Z',
            'backup' => [
                'id' => $copy['backup_id'],
                'sha256' => $copy['sha256'],
                'verified_at' => '2026-09-13T19:59:00Z',
                'destination_label' => 'USB-HOSPITAL-1',
                'external_copy_id' => $copy['id'],
                'bytes' => 2048,
            ],
            'max_invoice_number' => $maxInvoice,
            'max_receipt_number' => 0,
        ];

        $payload['hash'] = hash('sha256', RestoreReconciliationManifest::canonicalJson($payload));

        $path = tempnam(sys_get_temp_dir(), 'mw1-boundary-manifest-');
        if ($path === false) {
            throw new RuntimeException('No se pudo crear el manifiesto temporal.');
        }

        file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $this->tempFiles[] = $path;

        return ['path' => $path];
    }

    private function hash(string $seed): string
    {
        return hash('sha256', $seed);
    }
}
