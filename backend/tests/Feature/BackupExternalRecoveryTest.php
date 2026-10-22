<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Backups\BackupFileCipher;
use App\Actions\Backups\CreateBackupAction;
use App\Actions\Backups\ExternalBackupCopyAction;
use App\Actions\Backups\VerifyBackupAction;
use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * M-W1-BK-01 / F019 (HS-BK-EXT): la copia externa cifrada debe ser un origen
 * de recuperacion completo, no solo una fila `verified` en el ledger.
 *
 * Flujo probado con datos sinteticos y un destino de laboratorio real en
 * %TEMP% (fuera del storage y del proyecto):
 *
 *   1. respaldo local cifrado (.sql.gz.enc) con datos sinteticos;
 *   2. copia al destino externo + hash/tamano verificados contra el origen;
 *   3. perdida del archivo local (disco del servidor);
 *   4. recuperacion: se repone el archivo desde el destino externo;
 *   5. el respaldo repuesto vuelve a verificar (descifrado completo) y el dump
 *      contiene los datos sinteticos, que se importan en una base SQLite limpia
 *      y se validan por conteo.
 *
 * No declara un destino externo desplegado: el destino es sintetico y
 * desechable, creado y eliminado por el test.
 */
class BackupExternalRecoveryTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $temporaryPaths = [];

    protected function tearDown(): void
    {
        foreach ($this->temporaryPaths as $path) {
            if (is_dir($path)) {
                File::deleteDirectory($path);
            } elseif (is_file($path)) {
                @unlink($path);
            }
        }

        $this->temporaryPaths = [];

        parent::tearDown();
    }

    public function test_external_copy_recovers_synthetic_data_after_local_backup_is_lost(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            $this->markTestSkipped('El remonte del dump sintetico usa el SQLite de pruebas; en MariaDB el writer emite mysqldump.');
        }

        $this->seedSyntheticData();

        Storage::fake('local');
        $disk = Storage::disk('local');

        $backup = app(CreateBackupAction::class)->execute(null, BackupLog::TYPE_MANUAL);

        $this->assertSame(BackupLog::STATUS_SUCCESS, $backup->status);
        $this->assertTrue($disk->exists((string) $backup->path));
        $localBytes = $disk->get((string) $backup->path);
        $this->assertIsString($localBytes);
        $this->assertNotSame('', $localBytes);

        $externalRoot = $this->enableExternalCopyWithRealTempRoot();

        $copy = app(ExternalBackupCopyAction::class)->execute($backup);

        $this->assertSame(ExternalBackupCopyAction::STATUS_VERIFIED, $copy['status'], (string) ($copy['message'] ?? ''));
        $this->assertTrue($copy['external_configured']);
        $this->assertTrue($copy['external_deployed']);

        $row = DB::table('backup_external_copies')->where('backup_log_id', $backup->id)->first();
        $this->assertNotNull($row);
        $this->assertSame(ExternalBackupCopyAction::STATUS_VERIFIED, (string) $row->status);
        $this->assertNotNull($row->verified_at);

        $externalDisk = Storage::disk('backup_external');
        $this->assertTrue($externalDisk->exists((string) $row->relative_path));

        // El hash de la copia externa coincide con el checksum del respaldo local.
        $externalBytes = $externalDisk->get((string) $row->relative_path);
        $this->assertIsString($externalBytes);
        $this->assertSame(hash('sha256', $localBytes), hash('sha256', $externalBytes));
        $this->assertSame((string) $backup->checksum_sha256, hash('sha256', $externalBytes));
        $this->assertSame((int) $backup->size_bytes, strlen($externalBytes));
        $this->assertSame((int) $backup->size_bytes, (int) $row->bytes);
        $this->assertTrue(is_dir($externalRoot));

        // Perdida del disco local: el archivo cifrado del servidor ya no existe.
        $disk->delete((string) $backup->path);
        $this->assertFalse($disk->exists((string) $backup->path));

        // Recuperacion desde la copia externa: se repone el archivo en el disco
        // local con un nombre seguro nuevo y su hash/tamano registrados.
        $recoveredRelativePath = 'backups/recovered-'.$backup->filename;
        $disk->put($recoveredRelativePath, $externalBytes);

        $backup->forceFill([
            'path' => $recoveredRelativePath,
            'checksum_sha256' => hash('sha256', $externalBytes),
            'size_bytes' => strlen($externalBytes),
            'verify_status' => null,
            'verified_at' => null,
        ])->save();

        $verification = app(VerifyBackupAction::class)->execute($backup->fresh());

        $this->assertSame(VerifyBackupAction::STATUS_VERIFIED, $verification['status'], (string) ($verification['error'] ?? ''));
        $this->assertTrue($verification['checks']['file_exists']);
        $this->assertTrue($verification['checks']['size_matches']);
        $this->assertTrue($verification['checks']['checksum_matches']);
        $this->assertTrue($verification['checks']['key_matches']);
        $this->assertTrue($verification['checks']['decrypt_ok']);
        $this->assertSame(app(BackupFileCipher::class)->keyIdentifier(), $verification['key_identifier']);

        // El dump recuperado contiene los datos sinteticos y se importa en una
        // base limpia: la copia externa es un origen de restauracion real.
        $dump = $this->decryptRecoveredBackup($backup->fresh());

        $this->assertStringContainsString('CREATE TABLE', $dump);
        $this->assertStringContainsString('BEGIN TRANSACTION', $dump);
        $this->assertStringContainsString('Maria Lopez Recuperada', $dump);

        $restored = new \PDO('sqlite::memory:');
        $restored->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $restored->exec($dump);

        $this->assertSame(1, (int) $restored->query('select count(*) from invoices')->fetchColumn());
        $this->assertSame(1, (int) $restored->query('select count(*) from payments')->fetchColumn());
        $this->assertSame(1, (int) $restored->query('select count(*) from cash_register_sessions')->fetchColumn());
        $this->assertSame(
            'Maria Lopez Recuperada',
            (string) $restored->query('select patient_name from invoices limit 1')->fetchColumn(),
        );
    }

    /**
     * Destino externo real en %TEMP%: un disco `local` de filesystem fuera del
     * storage y del proyecto, no un Storage::fake. Lo crea y lo elimina el test.
     */
    private function enableExternalCopyWithRealTempRoot(): string
    {
        $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'s_hospital_external_recovery_'.bin2hex(random_bytes(6));
        $this->temporaryPaths[] = $root;

        Config::set('backups.external.enabled', true);
        Config::set('backups.external.disk', 'backup_external');
        Config::set('backups.external.path', 'hospital-backups');
        Config::set('backups.external.label', 'externo');
        Config::set('backups.external.verify', true);
        Config::set('filesystems.disks.backup_external', [
            'driver' => 'local',
            'root' => $root,
            'throw' => false,
            'report' => false,
        ]);

        return $root;
    }

    private function decryptRecoveredBackup(BackupLog $backup): string
    {
        $decryptedPath = storage_path('framework/testing/external-recovery-'.$backup->id.'.sql');
        @unlink($decryptedPath);

        $this->artisan('hospital:decrypt-backup', [
            'input' => Storage::disk('local')->path((string) $backup->path),
            'output' => $decryptedPath,
        ])->assertExitCode(0);

        $contents = (string) file_get_contents($decryptedPath);
        @unlink($decryptedPath);

        return $contents;
    }

    private function seedSyntheticData(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
        ]);

        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        $cashier = User::factory()->create([
            'username' => 'cashier-external-recovery',
        ]);
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoice = Invoice::query()->create([
            'invoice_number' => '000-001-01-00000001',
            'fiscal_sequence_id' => FiscalSequence::query()->first()->id,
            'fiscal_cai' => 'CAI',
            'patient_name' => 'Maria Lopez Recuperada',
            'subtotal' => '15.00',
            'subtotal_cents' => 1500,
            'tax_amount' => '2.25',
            'tax_amount_cents' => 225,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '17.25',
            'total_cents' => 1725,
            'paid_amount' => '17.25',
            'paid_amount_cents' => 1725,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $session->id,
            'issued_by' => $cashier->id,
            'issued_at' => now(),
        ]);

        Payment::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $session->id,
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '17.25',
            'amount_cents' => 1725,
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);

        // El servicio sembrado se referencia solo para dejar el catalogo cargado
        // con datos sinteticos reproducibles.
        $this->assertNotNull($service->id);
    }
}
