<?php

namespace Tests\Feature;

use App\Models\BackupLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class BackupKeyStatusCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_key_status_reports_fingerprint_without_key_material(): void
    {
        $exitCode = Artisan::call('hospital:backup-key-status', ['--json' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('"configured":true', $output);
        $this->assertStringNotContainsString('testing-local-backup-encryption-key', $output);

        $payload = json_decode(trim($output), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('configured', $payload['status']);
        $this->assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', (string) $payload['fingerprint']);
        $this->assertSame('aes-256-gcm', $payload['cipher']);
    }

    public function test_key_status_fails_when_key_is_missing(): void
    {
        Config::set('backups.encryption.key', null);

        $exitCode = Artisan::call('hospital:backup-key-status', ['--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('"configured":false', $output);
        $this->assertStringContainsString('"fingerprint":null', $output);
    }

    public function test_key_status_flags_backups_created_with_another_key(): void
    {
        BackupLog::query()->create([
            'filename' => 'rotated.sql.gz.enc',
            'path' => 'backups/rotated.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'encryption_key_id' => str_repeat('d', 64),
            'completed_at' => now(),
        ]);

        $exitCode = Artisan::call('hospital:backup-key-status', ['--json' => true]);
        $payload = json_decode(trim(Artisan::output()), true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame(0, $exitCode);
        $this->assertFalse($payload['latest_creation_key_matches']);
        $this->assertSame(1, $payload['backups_with_other_key']);
    }
}
