<?php

namespace App\Http\Controllers;

use App\Actions\Backups\CreateBackupAction;
use App\Jobs\RunBackupJob;
use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->user()->can('backups.view') || abort(403);

        $backups = BackupLog::query()
            ->with('creator:id,name,username')
            ->latest()
            ->paginate(max(1, min((int) $request->integer('per_page', 15), 50)));

        return response()->json([
            'data' => $backups->items(),
            'meta' => [
                'current_page' => $backups->currentPage(),
                'per_page' => $backups->perPage(),
                'total' => $backups->total(),
            ],
        ]);
    }

    public function store(Request $request, CreateBackupAction $createBackup): JsonResponse
    {
        $request->user()->can('backups.create') || abort(403);

        $backupLog = $createBackup->createPending($request->user(), BackupLog::TYPE_MANUAL);

        RunBackupJob::dispatch($backupLog->id);

        return response()->json([
            'data' => $backupLog,
        ], 202);
    }

    public function download(Request $request, BackupLog $backupLog): BinaryFileResponse
    {
        $request->user()->can('backups.download') || abort(403);

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
}
