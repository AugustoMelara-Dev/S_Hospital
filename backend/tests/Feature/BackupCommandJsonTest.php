<?php

namespace Tests\Feature;

use App\Models\BackupLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class BackupCommandJsonTest extends TestCase
{
    use RefreshDatabase;

    public function test_backup_command_emits_machine_readable_success_without_secrets_or_paths(): void
    {
        $exitCode = Artisan::call('hospital:backup', [
            '--type' => BackupLog::TYPE_MANUAL,
            '--json' => true,
        ]);

        $this->assertSame(0, $exitCode);

        $output = trim(Artisan::output());
        $payload = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
        $backup = BackupLog::query()->firstOrFail();

        $this->assertSame([
            'status' => 'success',
            'backup_log_id' => $backup->id,
            'filename' => $backup->filename,
            'checksum_sha256' => $backup->checksum_sha256,
            'encrypted' => true,
            'size_bytes' => $backup->size_bytes,
        ], $payload);
        $this->assertArrayNotHasKey('path', $payload);
        $this->assertArrayNotHasKey('disk', $payload);
        $this->assertStringNotContainsString('APP_KEY', $output);
        $this->assertStringNotContainsString('DB_PASSWORD', $output);
    }

    public function test_backup_command_emits_machine_readable_failure_for_invalid_type(): void
    {
        $exitCode = Artisan::call('hospital:backup', [
            '--type' => 'invalid',
            '--json' => true,
        ]);

        $this->assertSame(1, $exitCode);
        $this->assertSame([
            'status' => 'failed',
            'code' => 'INVALID_BACKUP_TYPE',
        ], json_decode(trim(Artisan::output()), true, flags: JSON_THROW_ON_ERROR));
    }
}
