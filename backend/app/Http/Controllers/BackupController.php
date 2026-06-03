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
        abort_unless($backupLog->status === BackupLog::STATUS_SUCCESS, 404);
        abort_unless($backupLog->disk === 'local', 404);
        abort_unless($backupLog->path !== null && $this->isSafeRelativeBackupPath($backupLog->path), 404);
        abort_unless(Storage::disk('local')->exists($backupLog->path), 404);

        $absolutePath = Storage::disk('local')->path($backupLog->path);
        $backupRoot = Storage::disk('local')->path('backups');
        abort_unless($this->isInsideBackupRoot($absolutePath, $backupRoot), 404);

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

        return response()->download($absolutePath, $backupLog->filename, [
            'Content-Type' => 'application/sql',
            'X-Content-Type-Options' => 'nosniff',
        ]);
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

    /**
     * @return array<string, mixed>
     */
    private function payload(BackupLog $backupLog): array
    {
        $payload = [
            'id' => $backupLog->id,
            'filename' => $backupLog->filename,
            'size_bytes' => $backupLog->size_bytes,
            'checksum_sha256' => $backupLog->checksum_sha256,
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

        return $payload;
    }
}
