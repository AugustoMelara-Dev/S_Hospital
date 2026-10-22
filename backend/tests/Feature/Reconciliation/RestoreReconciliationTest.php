<?php

declare(strict_types=1);

namespace Tests\Feature\Reconciliation;

use App\Actions\Billing\GenerateFiscalNumberAction;
use App\Actions\InstitutionalReceipts\ReserveInstitutionalReceiptNumberAction;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use App\Support\RestoreReconciliation;
use App\Support\RestoreReconciliationPendingException;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

/**
 * T2-037 / HS-RESTORE-SEQUENCE: bloqueo fail-closed de correlativos tras un
 * restore, reconciliacion con manifiesto externo y ledger de copias.
 */
class RestoreReconciliationTest extends TestCase
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

    public function test_fiscal_number_emission_is_blocked_while_reconciliation_pending(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 41);
        $this->startPendingReconciliation();

        try {
            app(GenerateFiscalNumberAction::class)->execute();
            $this->fail('La emision de facturas debio bloquearse con reconciliacion pendiente.');
        } catch (RestoreReconciliationPendingException $exception) {
            $this->assertStringContainsString('Reconciliacion post-restore pendiente', $exception->getMessage());
            $this->assertStringContainsString('facturas', $exception->getMessage());
        }

        $this->assertSame(41, $sequence->fresh()->current_number);
        $this->assertSame(0, Invoice::query()->count());
    }

    public function test_institutional_receipt_reservation_is_blocked_while_pending(): void
    {
        $series = $this->createActiveReceiptSeries(currentNumber: 7);
        $this->startPendingReconciliation();

        try {
            app(ReserveInstitutionalReceiptNumberAction::class)->execute();
            $this->fail('La reserva de recibos institucionales debio bloquearse con reconciliacion pendiente.');
        } catch (RestoreReconciliationPendingException $exception) {
            $this->assertStringContainsString('recibos institucionales', $exception->getMessage());
        }

        $this->assertSame(7, $series->fresh()->current_number);
    }

    public function test_status_json_reports_pending_state_and_current_database_maxima(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 41);
        $series = $this->createActiveReceiptSeries(currentNumber: 7);
        $this->startPendingReconciliation();

        $exitCode = Artisan::call('hospital:restore-reconciliation', ['action' => 'status', '--json' => true]);
        $payload = $this->decodeCommandOutput($exitCode === 0);

        $this->assertSame(0, $exitCode);
        $this->assertTrue($payload['pending']);
        $this->assertSame('database_cache', $payload['pending_state']['source']);
        $this->assertSame(41, $payload['max_invoice_number']['current_number']);
        $this->assertSame($sequence->id, $payload['max_invoice_number']['sequence_id']);
        $this->assertSame(7, $payload['max_receipt_number']['current_number']);
        $this->assertSame($series->id, $payload['max_receipt_number']['series_id']);
        $this->assertNull($payload['last_manifest']);
    }

    public function test_confirm_applies_manifest_advance_clears_pending_and_audits(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);
        $series = $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 10, maxReceipt: 8);

        $exitCode = Artisan::call('hospital:restore-reconciliation', [
            'action' => 'confirm',
            '--manifest' => $manifest['path'],
            '--phrase' => 'RECONCILIAR',
            '--reason' => 'Jefatura de finanzas autoriza reconciliar el restore del 2026-09-10',
            '--authorized-by' => 'Dra. Supervisora Finanzas',
            '--json' => true,
        ]);
        $payload = $this->decodeCommandOutput($exitCode === 0);

        $this->assertSame(0, $exitCode);
        $this->assertSame('ok', $payload['status']);
        $this->assertArrayHasKey('confirmed_at', $payload);
        $this->assertSame($manifest['hash'], $payload['manifest_hash']);
        $this->assertSame('verified', $payload['ledger_verification']['status']);

        $this->assertSame(10, $sequence->fresh()->current_number);
        $this->assertSame(8, $series->fresh()->current_number);
        $this->assertFalse(app(RestoreReconciliation::class)->isPending());

        // La emision se reanuda exactamente despues del ultimo numero reconciliado.
        $next = app(GenerateFiscalNumberAction::class)->execute();
        $this->assertSame(11, $next['next_number']);

        $audit = AuditLog::query()
            ->where('action', 'restore_reconciliation.confirmed')
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertSame('Dra. Supervisora Finanzas', $audit->new_values['authorized_by']);
        $this->assertSame($manifest['hash'], $audit->new_values['manifest']['hash']);
        $this->assertSame('verified', $audit->new_values['ledger_verification']['status']);
        $this->assertSame(10, $audit->new_values['invoice_advance']['to']);
        $this->assertTrue($audit->new_values['invoice_advance']['applied']);
        $this->assertSame(8, $audit->new_values['receipt_advance']['to']);
        $this->assertTrue($audit->new_values['receipt_advance']['applied']);

        // Status reporta el ultimo manifiesto registrado.
        $exitCode = Artisan::call('hospital:restore-reconciliation', ['action' => 'status', '--json' => true]);
        $status = $this->decodeCommandOutput($exitCode === 0);
        $this->assertFalse($status['pending']);
        $this->assertSame($manifest['hash'], $status['last_manifest']['hash']);
    }

    public function test_confirm_never_retreats_numbers_that_are_already_higher_in_database(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 50);
        $series = $this->createActiveReceiptSeries(currentNumber: 20);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 10, maxReceipt: 8);

        $exitCode = Artisan::call('hospital:restore-reconciliation', [
            'action' => 'confirm',
            '--manifest' => $manifest['path'],
            '--phrase' => 'RECONCILIAR',
            '--reason' => 'Manifiesto anterior al estado actual de la base',
            '--authorized-by' => 'Auditor Interno',
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertSame(50, $sequence->fresh()->current_number);
        $this->assertSame(20, $series->fresh()->current_number);
        $this->assertFalse(app(RestoreReconciliation::class)->isPending());

        $audit = AuditLog::query()
            ->where('action', 'restore_reconciliation.confirmed')
            ->orderByDesc('id')
            ->firstOrFail();

        $this->assertFalse($audit->new_values['invoice_advance']['applied']);
        $this->assertSame('manifest_not_ahead', $audit->new_values['invoice_advance']['reason']);
        $this->assertFalse($audit->new_values['receipt_advance']['applied']);
    }

    public function test_confirm_with_tampered_hash_fails_closed_without_changes(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);
        $series = $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest();
        $tampered = json_decode((string) file_get_contents($manifest['path']), true, flags: JSON_THROW_ON_ERROR);
        $tampered['max_invoice_number'] = 9999;
        file_put_contents($manifest['path'], json_encode($tampered, JSON_THROW_ON_ERROR));

        $payload = $this->confirmCommand($manifest['path']);

        $this->assertSame('CONFIRMACION_RECHAZADA', $payload['code']);
        $this->assertStringContainsString('hash', $payload['message']);
        $this->assertSame(5, $sequence->fresh()->current_number);
        $this->assertSame(3, $series->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
        $this->assertSame(1, AuditLog::query()->where('action', 'restore_reconciliation.confirmation_rejected')->count());
    }

    public function test_confirm_without_manifest_fails_closed(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);
        $this->startPendingReconciliation();

        $exitCode = Artisan::call('hospital:restore-reconciliation', [
            'action' => 'confirm',
            '--phrase' => 'RECONCILIAR',
            '--reason' => 'Intento sin evidencia externa',
            '--authorized-by' => 'Supervisor',
            '--json' => true,
        ]);
        $payload = $this->decodeCommandOutput($exitCode === 0);

        $this->assertSame(1, $exitCode);
        $this->assertSame('MANIFIESTO_REQUERIDO', $payload['code']);
        $this->assertStringContainsString('evidencia externa', $payload['message']);
        $this->assertSame(5, $sequence->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
    }

    public function test_confirm_rejects_manifest_without_verified_external_copy(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);
        $series = $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(withLedger: false);

        $payload = $this->confirmCommand($manifest['path']);

        $this->assertSame('CONFIRMACION_RECHAZADA', $payload['code']);
        $this->assertStringContainsString('ledger', $payload['message']);
        $this->assertSame(5, $sequence->fresh()->current_number);
        $this->assertSame(3, $series->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
    }

    public function test_confirm_requires_phrase_reason_and_authorized_by(): void
    {
        $this->createActiveInvoiceSequence(currentNumber: 5);
        $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();
        $manifest = $this->writeManifest();

        $wrongPhrase = $this->confirmCommand($manifest['path'], phrase: 'CONFIRMAR');
        $this->assertSame('CONFIRMACION_RECHAZADA', $wrongPhrase['code']);
        $this->assertStringContainsString('Frase de confirmacion', $wrongPhrase['message']);

        $missingAuthorizer = $this->confirmCommand($manifest['path'], authorizedBy: '');
        $this->assertSame('CONFIRMACION_RECHAZADA', $missingAuthorizer['code']);
        $this->assertStringContainsString('authorized-by', $missingAuthorizer['message']);

        $shortReason = $this->confirmCommand($manifest['path'], reason: 'x');
        $this->assertSame('CONFIRMACION_RECHAZADA', $shortReason['code']);
        $this->assertStringContainsString('motivo', strtolower($shortReason['message']));

        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
    }

    public function test_confirm_rejects_manifest_numbers_outside_authorized_range(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5, maxNumber: 100);
        $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 500, maxReceipt: 8);

        $payload = $this->confirmCommand($manifest['path']);

        $this->assertSame('CONFIRMACION_RECHAZADA', $payload['code']);
        $this->assertStringContainsString('rango autorizado', $payload['message']);
        $this->assertSame(5, $sequence->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
    }

    public function test_confirm_rejects_when_ledger_table_is_absent_and_keeps_block(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);
        $series = $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 10, maxReceipt: 8);

        $this->withoutLedgerTable(function () use ($manifest): void {
            $payload = $this->confirmCommand($manifest['path']);

            $this->assertSame('CONFIRMACION_RECHAZADA', $payload['code']);
            $this->assertStringContainsString('backup_external_copies', $payload['message']);
        });

        $this->assertSame(5, $sequence->fresh()->current_number);
        $this->assertSame(3, $series->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
        $this->assertSame(1, AuditLog::query()->where('action', 'restore_reconciliation.confirmation_rejected')->count());
    }

    public function test_confirm_rejects_manifest_with_invoice_numbers_when_no_active_sequence(): void
    {
        $series = $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 10, maxReceipt: 8);

        $payload = $this->confirmCommand($manifest['path']);

        $this->assertSame('CONFIRMACION_RECHAZADA', $payload['code']);
        $this->assertStringContainsString('secuencia', $payload['message']);
        $this->assertSame(3, $series->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
        $this->assertSame(1, AuditLog::query()->where('action', 'restore_reconciliation.confirmation_rejected')->count());
    }

    public function test_confirm_rejects_manifest_with_receipt_numbers_when_no_active_series(): void
    {
        $sequence = $this->createActiveInvoiceSequence(currentNumber: 5);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 10, maxReceipt: 8);

        $payload = $this->confirmCommand($manifest['path']);

        $this->assertSame('CONFIRMACION_RECHAZADA', $payload['code']);
        $this->assertStringContainsString('serie', $payload['message']);
        // El rechazo revierte tambien el avance de facturas de la misma transaccion.
        $this->assertSame(5, $sequence->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
        $this->assertSame(0, AuditLog::query()->where('action', 'restore_reconciliation.confirmed')->count());
    }

    public function test_confirm_allows_zero_maxima_without_active_targets(): void
    {
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 0, maxReceipt: 0);

        $exitCode = Artisan::call('hospital:restore-reconciliation', [
            'action' => 'confirm',
            '--manifest' => $manifest['path'],
            '--phrase' => 'RECONCILIAR',
            '--reason' => 'Custodia externa confirma cero correlativos usados',
            '--authorized-by' => 'Supervisor Finanzas',
            '--json' => true,
        ]);
        $payload = $this->decodeCommandOutput($exitCode === 0);

        $this->assertSame(0, $exitCode);
        $this->assertSame('ok', $payload['status']);
        $this->assertFalse($payload['invoice_advance']['applied']);
        $this->assertSame('no_active_sequence', $payload['invoice_advance']['reason']);
        $this->assertFalse($payload['receipt_advance']['applied']);
        $this->assertSame('no_active_series', $payload['receipt_advance']['reason']);
        $this->assertFalse(app(RestoreReconciliation::class)->isPending());
    }

    public function test_confirm_rejects_manifest_receipt_number_outside_authorized_range(): void
    {
        $this->createActiveInvoiceSequence(currentNumber: 5);
        $series = $this->createActiveReceiptSeries(currentNumber: 3, maxNumber: 100);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 10, maxReceipt: 500);

        $payload = $this->confirmCommand($manifest['path']);

        $this->assertSame('CONFIRMACION_RECHAZADA', $payload['code']);
        $this->assertStringContainsString('recibo', strtolower($payload['message']));
        $this->assertStringContainsString('rango autorizado', $payload['message']);
        $this->assertSame(3, $series->fresh()->current_number);
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());
    }

    public function test_start_is_idempotent_and_preserves_started_at(): void
    {
        $this->createActiveInvoiceSequence(currentNumber: 5);

        $first = app(RestoreReconciliation::class)->start('Restore inicial de la copia 2026-09-10', 'hs-recovery');
        $second = app(RestoreReconciliation::class)->start('Se repite start al reiniciar el procedimiento', 'hs-install');

        $this->assertSame($first['started_at'], $second['started_at']);
        $this->assertSame('Se repite start al reiniciar el procedimiento', $second['reason']);
        $this->assertTrue($second['pending']);
        $this->assertTrue($second['marker_stored']);
        $this->assertSame(2, AuditLog::query()->where('action', 'restore_reconciliation.started')->count());
        $this->assertTrue(app(RestoreReconciliation::class)->isPending());

        $marker = Cache::store('database')->get(RestoreReconciliation::CACHE_KEY);
        $this->assertIsArray($marker);
        $this->assertSame($first['started_at'], $marker['started_at']);
        $this->assertSame('Se repite start al reiniciar el procedimiento', $marker['reason']);
    }

    public function test_receipt_reservation_resumes_at_next_number_after_confirm(): void
    {
        $this->createActiveInvoiceSequence(currentNumber: 5);
        $series = $this->createActiveReceiptSeries(currentNumber: 3);
        $this->startPendingReconciliation();

        $manifest = $this->writeManifest(maxInvoice: 10, maxReceipt: 8);

        $exitCode = Artisan::call('hospital:restore-reconciliation', [
            'action' => 'confirm',
            '--manifest' => $manifest['path'],
            '--phrase' => 'RECONCILIAR',
            '--reason' => 'Reconciliacion autorizada por finanzas',
            '--authorized-by' => 'Supervisor Finanzas',
            '--json' => true,
        ]);

        $this->assertSame(0, $exitCode);

        $reservation = app(ReserveInstitutionalReceiptNumberAction::class)->execute();

        $this->assertSame(9, $reservation['number']);
        $this->assertSame(9, $series->fresh()->current_number);
    }

    public function test_pending_marker_is_durable_in_database_cache_and_audit_fallback(): void
    {
        $this->createActiveInvoiceSequence(currentNumber: 5);
        $this->startPendingReconciliation();

        $databaseKey = (string) config('cache.prefix').RestoreReconciliation::CACHE_KEY;
        $marker = Cache::store('database')->get(RestoreReconciliation::CACHE_KEY);

        $this->assertIsArray($marker);
        $this->assertSame('pending', $marker['status']);
        $this->assertSame(1, DB::table('cache')->where('key', $databaseKey)->count());
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'restore_reconciliation.started',
            'result' => 'success',
        ]);

        // Si un `cache:clear` borra el marcador, la auditoria mantiene el
        // bloqueo fail-closed hasta la confirmacion.
        Cache::store('database')->forget(RestoreReconciliation::CACHE_KEY);

        $reconciliation = app(RestoreReconciliation::class);
        $this->assertTrue($reconciliation->isPending());
        $this->assertSame('audit_fallback', $reconciliation->pendingState()['source']);
    }

    public function test_invoice_api_does_not_consume_numbers_while_pending(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
        ]);

        $sequence = $this->createActiveInvoiceSequence(currentNumber: 41);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $this->startPendingReconciliation();

        $response = $this->actingAs($cashier)->postJson('/api/invoices', [
            'patient_name' => 'Paciente bloqueado',
            'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
        ]);

        $response->assertStatus(500);
        $this->assertStringContainsString('post-restore', (string) $response->getContent());
        $this->assertSame(0, Invoice::query()->count());
        $this->assertSame(41, $sequence->fresh()->current_number);
        $this->assertSame(0, AuditLog::query()->where('action', 'invoice.issued')->count());
    }

    private function startPendingReconciliation(string $reason = 'Restore de copia antigua 2026-09-10'): void
    {
        app(RestoreReconciliation::class)->start($reason, 'phpunit');
    }

    /**
     * Simula una base restaurada anterior a la migracion del ledger T2-025
     * (backup_external_copies ausente). El DDL corre dentro de la transaccion
     * de RefreshDatabase, que SQLite revierte al terminar el test; aun asi se
     * recrea la tabla en `finally` para no depender de ese detalle.
     *
     * En MariaDB el DDL provoca commit implicito y romperia el aislamiento de
     * la suite; el branch no depende del motor, por lo que ahi se declara skip.
     */
    private function withoutLedgerTable(callable $callback): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            $this->markTestSkipped('Ledger ausente se simula con DDL transaccional de SQLite; en MariaDB el DDL hace commit implicito y romperia el aislamiento de la suite.');
        }

        $migration = include base_path('database/migrations/2026_09_13_200001_create_backup_external_copies_table.php');

        $migration->down();
        $this->assertFalse(Schema::hasTable('backup_external_copies'));

        try {
            $callback();
        } finally {
            $migration->up();
            $this->assertTrue(Schema::hasTable('backup_external_copies'));
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function confirmCommand(
        string $manifestPath,
        string $phrase = 'RECONCILIAR',
        string $reason = 'Reconciliacion autorizada por finanzas',
        string $authorizedBy = 'Supervisor Finanzas',
    ): array {
        $exitCode = Artisan::call('hospital:restore-reconciliation', [
            'action' => 'confirm',
            '--manifest' => $manifestPath,
            '--phrase' => $phrase,
            '--reason' => $reason,
            '--authorized-by' => $authorizedBy,
            '--json' => true,
        ]);

        $payload = $this->decodeCommandOutput($exitCode === 0);
        $this->assertSame(1, $exitCode, 'La confirmacion debio fallar cerrado.');

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeCommandOutput(bool $expectedSuccess): array
    {
        $output = trim(Artisan::output());

        try {
            $payload = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new RuntimeException("Salida de comando no JSON: {$output}");
        }

        if (! is_array($payload)) {
            throw new RuntimeException("Salida de comando inesperada: {$output}");
        }

        if ($expectedSuccess) {
            $this->assertSame('ok', $payload['status'] ?? null, "Comando inesperado: {$output}");
        } else {
            $this->assertSame('failed', $payload['status'] ?? null, "Comando inesperado: {$output}");
        }

        return $payload;
    }

    private function createActiveInvoiceSequence(
        int $currentNumber = 0,
        int $maxNumber = 99999999,
        string $prefix = '000-001-01',
    ): FiscalSequence {
        return FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => $prefix,
            'min_number' => 1,
            'max_number' => $maxNumber,
            'current_number' => $currentNumber,
            'cai' => 'CAI-TEST-'.bin2hex(random_bytes(4)),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function createActiveReceiptSeries(int $currentNumber = 0, int $maxNumber = 1000): InstitutionalReceiptSeries
    {
        return InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-T2037',
            'prefix' => 'RT',
            'number_format' => '{prefix}-{number:08}',
            'min_number' => 1,
            'max_number' => $maxNumber,
            'current_number' => $currentNumber,
            'active' => true,
        ]);
    }

    /**
     * Escribe un manifiesto valido con (o sin) la copia externa `verified`
     * correspondiente en el ledger.
     *
     * @return array{path: string, hash: string, backup_id: int, copy_id: int|null}
     */
    private function writeManifest(
        int $maxInvoice = 10,
        int $maxReceipt = 8,
        bool $withLedger = true,
        array $payloadOverrides = [],
    ): array {
        $backup = BackupLog::query()->create([
            'filename' => 'backup-t2037-'.uniqid().'.sql.enc',
            'disk' => 'local',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', 'backup-t2037-'.uniqid('', true)),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'format' => 'sql',
            'encrypted' => true,
            'completed_at' => now(),
        ]);

        $copyId = null;

        if ($withLedger) {
            $copyId = (int) DB::table('backup_external_copies')->insertGetId([
                'backup_log_id' => $backup->id,
                'destination_label' => 'USB-HOSPITAL-1',
                'relative_path' => 'copies/backup-t2037.sql.enc',
                'sha256' => $backup->checksum_sha256,
                'bytes' => 1024,
                'status' => 'verified',
                'copied_at' => now(),
                'verified_at' => now(),
                'metadata' => json_encode(['suite' => 't2037'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $payload = array_replace_recursive([
            'schema_version' => 1,
            'generated_at' => '2026-09-13T20:00:00Z',
            'backup' => [
                'id' => $backup->id,
                'sha256' => $backup->checksum_sha256,
                'verified_at' => '2026-09-13T19:59:00Z',
                'destination_label' => 'USB-HOSPITAL-1',
                'relative_path' => 'copies/backup-t2037.sql.enc',
                'external_copy_id' => $copyId,
                'bytes' => 1024,
            ],
            'max_invoice_number' => $maxInvoice,
            'max_receipt_number' => $maxReceipt,
        ], $payloadOverrides);

        if ($copyId === null) {
            unset($payload['backup']['external_copy_id']);
        }

        $hash = hash('sha256', $this->canonicalJson($payload));
        $payload['hash'] = $hash;

        $path = tempnam(sys_get_temp_dir(), 't2037-manifest-');
        if ($path === false) {
            throw new RuntimeException('No se pudo crear el manifiesto temporal.');
        }

        file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $this->tempFiles[] = $path;

        return ['path' => $path, 'hash' => $hash, 'backup_id' => $backup->id, 'copy_id' => $copyId];
    }

    /**
     * Implementacion independiente del hash canonico (no reutiliza el parser).
     *
     * @param  array<string, mixed>  $payload
     */
    private function canonicalJson(array $payload): string
    {
        $sort = static function (array &$value) use (&$sort): void {
            if (! array_is_list($value)) {
                ksort($value, SORT_STRING);
            }

            foreach ($value as &$child) {
                if (is_array($child)) {
                    $sort($child);
                }
            }
            unset($child);
        };

        $sort($payload);

        return json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
