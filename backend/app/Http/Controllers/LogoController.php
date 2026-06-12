<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\UploadLogoRequest;
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
        $lastModified = file_exists($path) ? filemtime($path) : time();

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

        // Store as branding/logo.png on public disk
        $request->file('logo')->storeAs('branding', 'logo.png', 'public');

        $path = Storage::disk('public')->path('branding/logo.png');
        $time = file_exists($path) ? filemtime($path) : time();

        return response()->json([
            'message' => 'Logo actualizado con exito.',
            'logo_url' => '/api/settings/logo/file?t='.$time,
        ]);
    }

    private function cacheBustedLogoUrl(): ?string
    {
        if (! Storage::disk('public')->exists('branding/logo.png')) {
            return null;
        }

        $path = Storage::disk('public')->path('branding/logo.png');
        $time = file_exists($path) ? filemtime($path) : time();

        return '/api/settings/logo/file?t='.$time;
    }
}
