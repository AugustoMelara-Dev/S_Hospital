<?php

namespace App\Http\Controllers;

use App\Actions\Backups\CreateBackupAction;
use App\Http\Requests\Backups\DownloadBackupRequest;
use App\Http\Requests\Backups\IndexBackupRequest;
use App\Http\Requests\Backups\StoreBackupRequest;
use App\Jobs\RunBackupJob;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    public function index(IndexBackupRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $backups = BackupLog::query()
            ->with('creator:id,name,username')
            ->when(
                ! empty($validated['status']),
                fn ($query) => $query->where('status', $validated['status']),
            )
            ->latest()
            ->paginate($request->perPage());

        return response()->json([
            'data' => collect($backups->items())->map(fn (BackupLog $backupLog): array => $this->payload($backupLog))->values(),
            'meta' => [
                'current_page' => $backups->currentPage(),
                'per_page' => $backups->perPage(),
                'total' => $backups->total(),
            ],
        ]);
    }

    public function store(StoreBackupRequest $request, CreateBackupAction $createBackup): JsonResponse
    {
        $backupLog = $createBackup->createPending($request->user(), BackupLog::TYPE_MANUAL);
        RunBackupJob::dispatch($backupLog->id);

        return response()->json([
            'data' => $this->payload($backupLog),
        ], 202);
    }

    public function download(DownloadBackupRequest $request, BackupLog $backupLog): BinaryFileResponse
    {
        if ($backupLog->status !== BackupLog::STATUS_SUCCESS) {
            $this->denyDownload($request, $backupLog, 'status_not_success');
        }

        if ($backupLog->disk !== 'local') {
            $this->denyDownload($request, $backupLog, 'unsupported_disk');
        }

        if ($backupLog->path === null || ! $this->isSafeRelativeBackupPath($backupLog->path)) {
            $this->denyDownload($request, $backupLog, 'unsafe_path');
        }

        if (! Storage::disk('local')->exists($backupLog->path)) {
            $this->denyDownload($request, $backupLog, 'missing_file');
        }

        $absolutePath = Storage::disk('local')->path($backupLog->path);
        $backupRoot = Storage::disk('local')->path('backups');
        if (! $this->isInsideBackupRoot($absolutePath, $backupRoot)) {
            $this->denyDownload($request, $backupLog, 'outside_backup_root');
        }

        if (! $this->matchesRecordedIntegrity($backupLog, $absolutePath)) {
            $this->denyDownload($request, $backupLog, 'integrity_mismatch');
        }

        AuditLog::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'backup.downloaded',
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => [
                'filename' => $backupLog->filename,
                'size_bytes' => $backupLog->size_bytes,
                'checksum_sha256' => $backupLog->checksum_sha256,
            ],
            'created_at' => now(),
        ]);

        return response()->download($absolutePath, $this->safeDownloadFilename($backupLog->filename), [
            'Content-Type' => 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function denyDownload(DownloadBackupRequest $request, BackupLog $backupLog, string $reason): never
    {
        AuditLog::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'backup.download_denied',
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => [
                'reason' => $reason,
                'status' => $backupLog->status,
                'disk' => $backupLog->disk,
                'has_path' => $backupLog->path !== null,
            ],
            'created_at' => now(),
        ]);

        abort(404);
    }

    private function isSafeRelativeBackupPath(string $path): bool
    {
        return str_starts_with($path, 'backups/')
            && ! str_contains($path, '..')
            && ! str_contains($path, '\\')
            && ! str_starts_with($path, '/');
    }

    private function isInsideBackupRoot(string $absolutePath, string $backupRoot): bool
    {
        $realPath = realpath($absolutePath);
        $realRoot = realpath($backupRoot);

        if ($realPath === false || $realRoot === false) {
            return false;
        }

        return str_starts_with($realPath, rtrim($realRoot, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR);
    }

    private function matchesRecordedIntegrity(BackupLog $backupLog, string $absolutePath): bool
    {
        if ($backupLog->size_bytes === null || $backupLog->checksum_sha256 === null) {
            return false;
        }

        $actualSize = filesize($absolutePath);
        $actualChecksum = hash_file('sha256', $absolutePath);

        if ($actualSize === false || $actualChecksum === false) {
            return false;
        }

        return (int) $backupLog->size_bytes === (int) $actualSize
            && hash_equals($backupLog->checksum_sha256, $actualChecksum);
    }

    private function safeDownloadFilename(string $filename): string
    {
        $safeFallback = 'hospital-backup-download.sql.gz.enc';
        $normalized = str_replace('\\', '/', $filename);

        if (basename($normalized) !== $filename) {
            return $safeFallback;
        }

        if (! preg_match('/\A[A-Za-z0-9][A-Za-z0-9._-]{0,160}\.sql(\.enc|\.gz\.enc)?\z/', $filename)) {
            return $safeFallback;
        }

        return $filename;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(BackupLog $backupLog): array
    {
        $payload = [
            'id' => $backupLog->id,
            'size_bytes' => $backupLog->size_bytes,
            'status' => $backupLog->status,
            'type' => $backupLog->type,
            'created_by' => $backupLog->created_by,
            'completed_at' => $backupLog->completed_at,
            'created_at' => $backupLog->created_at,
            'updated_at' => $backupLog->updated_at,
            'creator' => $backupLog->creator,
        ];

        if ($backupLog->status === BackupLog::STATUS_FAILED) {
            $payload['error_message'] = OperationalMessageSanitizer::message($backupLog->error_message);
        }

        if ($backupLog->status === BackupLog::STATUS_SUCCESS && is_string($backupLog->checksum_sha256)) {
            $payload['checksum_sha256'] = $backupLog->checksum_sha256;
        }

        return $payload;
    }
}
