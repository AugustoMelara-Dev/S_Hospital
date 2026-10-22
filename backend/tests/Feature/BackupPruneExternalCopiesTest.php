<?php

namespace Tests\Feature;

use App\Actions\Backups\PruneBackupsAction;
use App\Models\BackupLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BackupPruneExternalCopiesTest extends TestCase
{
    use RefreshDatabase;

    public function test_backup_with_external_copy_is_not_pruned(): void
    {
        Storage::fake('local');

        $newest = $this->successfulBackupLog('newest.sql', 'backups/newest.sql', now()->subDay());
        $oldWithCopy = $this->successfulBackupLog('old-copy.sql', 'backups/old-copy.sql', now()->subDays(2));
        $oldWithoutCopy = $this->successfulBackupLog('old-free.sql', 'backups/old-free.sql', now()->subDays(3));

        DB::table('backup_external_copies')->insert([
            'backup_log_id' => $oldWithCopy->id,
            'destination_label' => 'externo',
            'relative_path' => 'hospital-backups/old-copy.sql',
            'sha256' => str_repeat('a', 64),
            'bytes' => 9,
            'status' => 'verified',
            'copied_at' => now(),
            'verified_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $pruned = app(PruneBackupsAction::class)->execute(1);

        $this->assertSame(1, $pruned);
        $this->assertDatabaseHas('backup_logs', ['id' => $newest->id]);
        $this->assertDatabaseHas('backup_logs', ['id' => $oldWithCopy->id]);
        $this->assertDatabaseMissing('backup_logs', ['id' => $oldWithoutCopy->id]);
        $this->assertTrue(Storage::disk('local')->exists('backups/old-copy.sql'));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.pruned',
            'entity_id' => $oldWithoutCopy->id,
        ]);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'backup.pruned',
            'entity_id' => $oldWithCopy->id,
        ]);
    }

    public function test_backup_can_be_pruned_after_its_external_copy_record_is_removed(): void
    {
        Storage::fake('local');

        $newest = $this->successfulBackupLog('newest.sql', 'backups/newest.sql', now()->subDay());
        $oldWithCopy = $this->successfulBackupLog('old-copy.sql', 'backups/old-copy.sql', now()->subDays(2));

        DB::table('backup_external_copies')->insert([
            'backup_log_id' => $oldWithCopy->id,
            'destination_label' => 'externo',
            'status' => 'verified',
            'sha256' => str_repeat('a', 64),
            'bytes' => 9,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertSame(0, app(PruneBackupsAction::class)->execute(1));
        $this->assertDatabaseHas('backup_logs', ['id' => $oldWithCopy->id]);

        DB::table('backup_external_copies')->where('backup_log_id', $oldWithCopy->id)->delete();

        $pruned = app(PruneBackupsAction::class)->execute(1);

        $this->assertSame(1, $pruned);
        $this->assertDatabaseMissing('backup_logs', ['id' => $oldWithCopy->id]);
        $this->assertDatabaseHas('backup_logs', ['id' => $newest->id]);
        $this->assertFalse(Storage::disk('local')->exists('backups/old-copy.sql'));
    }

    private function successfulBackupLog(string $filename, string $path, \DateTimeInterface $completedAt): BackupLog
    {
        Storage::disk('local')->put($path, 'select 1;');

        return BackupLog::query()->create([
            'filename' => $filename,
            'path' => $path,
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'size_bytes' => 9,
            'checksum_sha256' => hash('sha256', 'select 1;'),
            'completed_at' => $completedAt,
        ]);
    }
}
