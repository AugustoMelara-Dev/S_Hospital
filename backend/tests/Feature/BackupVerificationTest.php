<?php

namespace Tests\Feature;

use App\Actions\Backups\BackupFileCipher;
use App\Actions\Backups\CreateBackupAction;
use App\Actions\Backups\VerifyBackupAction;
use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BackupVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_verify_action_marks_backup_verified_and_records_fingerprint(): void
    {
        $backup = $this->createBackup();

        $result = app(VerifyBackupAction::class)->execute($backup);

        $this->assertSame(VerifyBackupAction::STATUS_VERIFIED, $result['status']);
        $this->assertTrue($result['checks']['file_exists']);
        $this->assertTrue($result['checks']['size_matches']);
        $this->assertTrue($result['checks']['checksum_matches']);
        $this->assertTrue($result['checks']['key_matches']);
        $this->assertTrue($result['checks']['decrypt_ok']);
        $this->assertSame(VerifyBackupAction::SCOPE_ENCRYPTED_FILE_INTEGRITY, $result['verification_scope']);
        $this->assertFalse($result['restore_tested']);
        $this->assertSame(app(BackupFileCipher::class)->keyIdentifier(), $result['key_identifier']);

        $backup->refresh();
        $this->assertSame(VerifyBackupAction::STATUS_VERIFIED, $backup->verify_status);
        $this->assertNotNull($backup->verified_at);
        $this->assertSame(app(BackupFileCipher::class)->keyIdentifier(), $backup->key_identifier);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.verified',
            'result' => 'success',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_verify_action_marks_key_mismatch_without_touching_verified_at(): void
    {
        $backup = $this->createBackup();

        Config::set('backups.encryption.key', 'synthetic-rotated-backup-key');

        $result = app(VerifyBackupAction::class)->execute($backup);

        $this->assertSame(VerifyBackupAction::STATUS_KEY_MISMATCH, $result['status']);
        $this->assertFalse($result['checks']['key_matches']);
        $this->assertFalse($result['checks']['decrypt_ok']);

        $backup->refresh();
        $this->assertSame(VerifyBackupAction::STATUS_KEY_MISMATCH, $backup->verify_status);
        $this->assertNull($backup->verified_at);
        $this->assertSame(app(BackupFileCipher::class)->keyIdentifier(), $backup->key_identifier);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.verify_failed',
            'result' => 'failed',
            'entity_id' => $backup->id,
        ]);
    }

    public function test_verify_key_mismatch_preserves_previous_key_identifier_when_key_is_missing(): void
    {
        $backup = $this->createBackup();

        $first = app(VerifyBackupAction::class)->execute($backup);
        $this->assertSame(VerifyBackupAction::STATUS_VERIFIED, $first['status']);

        $backup->refresh();
        $previousIdentifier = (string) $backup->key_identifier;
        $previousVerifiedAt = (string) $backup->verified_at;
        $this->assertNotSame('', $previousIdentifier);

        Config::set('backups.encryption.key', null);

        $result = app(VerifyBackupAction::class)->execute($backup);

        $this->assertSame(VerifyBackupAction::STATUS_KEY_MISMATCH, $result['status']);
        $this->assertNull($result['key_identifier']);

        $backup->refresh();
        $this->assertSame(VerifyBackupAction::STATUS_KEY_MISMATCH, $backup->verify_status);
        $this->assertSame($previousIdentifier, (string) $backup->key_identifier);
        $this->assertSame($previousVerifiedAt, (string) $backup->verified_at);
    }

    public function test_verify_action_marks_failed_when_file_is_tampered(): void
    {
        $backup = $this->createBackup();
        $absolutePath = Storage::disk('local')->path((string) $backup->path);
        $bytes = (string) file_get_contents($absolutePath);
        $bytes[20] = chr(ord($bytes[20]) ^ 0xFF);
        file_put_contents($absolutePath, $bytes);

        $result = app(VerifyBackupAction::class)->execute($backup);

        $this->assertSame(VerifyBackupAction::STATUS_FAILED, $result['status']);
        $this->assertTrue($result['checks']['file_exists']);
        $this->assertFalse($result['checks']['checksum_matches']);

        $backup->refresh();
        $this->assertSame(VerifyBackupAction::STATUS_FAILED, $backup->verify_status);
        $this->assertNull($backup->verified_at);
    }

    public function test_verify_action_marks_failed_when_file_is_missing(): void
    {
        $backup = $this->createBackup();
        Storage::disk('local')->delete((string) $backup->path);

        $result = app(VerifyBackupAction::class)->execute($backup);

        $this->assertSame(VerifyBackupAction::STATUS_FAILED, $result['status']);
        $this->assertFalse($result['checks']['file_exists']);

        $backup->refresh();
        $this->assertSame(VerifyBackupAction::STATUS_FAILED, $backup->verify_status);
    }

    public function test_verify_action_accepts_legacy_single_payload_format(): void
    {
        Storage::fake('local');

        $payload = app(BackupFileCipher::class)->encryptString((string) gzencode('CREATE TABLE legacy_backup (id integer);'));
        $path = 'backups/legacy-single-payload.sql.gz.enc';
        Storage::disk('local')->put($path, $payload);

        $backup = BackupLog::query()->create([
            'filename' => 'legacy-single-payload.sql.gz.enc',
            'path' => $path,
            'disk' => 'local',
            'size_bytes' => strlen($payload),
            'checksum_sha256' => hash('sha256', $payload),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'encrypted' => true,
            'completed_at' => now(),
        ]);

        $result = app(VerifyBackupAction::class)->execute($backup);

        $this->assertSame(VerifyBackupAction::STATUS_VERIFIED, $result['status']);
        $this->assertTrue($result['checks']['decrypt_ok']);
    }

    public function test_verify_command_latest_json_does_not_expose_key_material(): void
    {
        $this->createBackup();

        $exitCode = Artisan::call('hospital:verify-backup', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('"status":"verified"', $output);
        $this->assertStringContainsString('"verification_scope":"encrypted_file_integrity"', $output);
        $this->assertStringContainsString('"restore_tested":false', $output);
        $this->assertStringContainsString('"key_identifier"', $output);
        $this->assertStringNotContainsString('testing-local-backup-encryption-key', $output);
    }

    public function test_verify_command_requires_exactly_one_selector(): void
    {
        $exitCode = Artisan::call('hospital:verify-backup', ['--json' => true]);

        $this->assertSame(1, $exitCode);

        $backup = $this->createBackup();
        $exitCode = Artisan::call('hospital:verify-backup', [
            'backup' => $backup->id,
            '--latest' => true,
            '--json' => true,
        ]);

        $this->assertSame(1, $exitCode);
    }

    public function test_verify_command_rejects_non_success_backup(): void
    {
        $backup = BackupLog::query()->create([
            'filename' => 'pending.sql.gz.enc',
            'path' => 'backups/pending.sql.gz.enc',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
        ]);

        $exitCode = Artisan::call('hospital:verify-backup', [
            'backup' => $backup->id,
            '--json' => true,
        ]);

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('estado success', Artisan::output());
    }

    public function test_system_status_exposes_last_recoverable_backup(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $backup = BackupLog::query()->create([
            'filename' => 'recoverable.sql.gz.enc',
            'path' => 'backups/recoverable.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'encrypted' => true,
            'completed_at' => now(),
        ]);
        $backup->forceFill([
            'verify_status' => VerifyBackupAction::STATUS_VERIFIED,
            'verified_at' => now()->toDateTimeString(),
            'key_identifier' => str_repeat('b', 64),
        ])->save();

        $response = $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.last_recoverable_backup_id', $backup->id);

        $this->assertNotNull($response->json('data.backups.last_recoverable_at'));
        $this->assertIsInt($response->json('data.backups.last_recoverable_age_seconds'));
    }

    private function createBackup(): BackupLog
    {
        Storage::fake('local');

        $backup = app(CreateBackupAction::class)->execute(null, BackupLog::TYPE_MANUAL);

        $this->assertSame(BackupLog::STATUS_SUCCESS, $backup->status);

        return $backup;
    }
}
