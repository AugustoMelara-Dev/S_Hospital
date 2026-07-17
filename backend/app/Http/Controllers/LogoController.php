<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\UploadLogoRequest;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class LogoController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'logo_url' => $this->cacheBustedLogoUrl(),
        ]);
    }

    public function file(): BinaryFileResponse
    {
        abort_unless(Storage::disk('public')->exists('branding/logo.png'), 404);

        $path = Storage::disk('public')->path('branding/logo.png');
        $lastModified = $this->fileModificationTime($path);

        return response()->file($path, [
            'Cache-Control' => 'public, max-age=300, stale-while-revalidate=300',
            'Last-Modified' => gmdate('D, d M Y H:i:s', $lastModified).' GMT',
            'Content-Type' => File::mimeType($path) ?: 'image/png',
        ]);
    }

    public function upload(UploadLogoRequest $request): JsonResponse
    {
        if (! $request->file('logo')?->isValid()) {
            throw ValidationException::withMessages([
                'logo' => ['El archivo del logo no es valido.'],
            ]);
        }

        $disk = Storage::disk('public');
        $oldPath = $disk->path('branding/logo.png');
        $oldValues = is_file($oldPath)
            ? [
                'sha256' => hash_file('sha256', $oldPath),
                'size_bytes' => filesize($oldPath),
                'mime_type' => File::mimeType($oldPath) ?: 'application/octet-stream',
            ]
            : null;

        // Store as branding/logo.png on public disk
        $request->file('logo')->storeAs('branding', 'logo.png', 'public');

        $path = $disk->path('branding/logo.png');
        $time = $this->fileModificationTime($path);

        AuditLog::query()->create([
            'user_id' => $request->user()?->id,
            'action' => 'settings.logo.updated',
            'entity_type' => 'settings.logo',
            'entity_id' => null,
            'old_values' => $oldValues,
            'new_values' => [
                'sha256' => is_file($path) ? hash_file('sha256', $path) : null,
                'size_bytes' => is_file($path) ? filesize($path) : null,
                'mime_type' => is_file($path) ? (File::mimeType($path) ?: 'application/octet-stream') : null,
            ],
            'ip' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Logo actualizado con exito.',
            'logo_url' => '/api/settings/logo/file?t='.$time,
        ]);
    }

    private function fileModificationTime(string $path): int
    {
        $timestamp = is_file($path) ? filemtime($path) : false;

        return is_int($timestamp) ? $timestamp : time();
    }

    private function cacheBustedLogoUrl(): ?string
    {
        if (! Storage::disk('public')->exists('branding/logo.png')) {
            return null;
        }

        $path = Storage::disk('public')->path('branding/logo.png');
        $time = $this->fileModificationTime($path);

        return '/api/settings/logo/file?t='.$time;
    }
}
