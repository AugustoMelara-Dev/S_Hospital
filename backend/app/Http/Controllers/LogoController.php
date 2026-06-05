<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\UploadLogoRequest;
use App\Models\AuditLog;
use App\Models\FiscalSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class LogoController extends Controller
{
    public function show(): JsonResponse
    {
        $exists = Storage::disk('public')->exists('branding/logo.png');
        $url = null;

        if ($exists) {
            $path = Storage::disk('public')->path('branding/logo.png');
            $time = file_exists($path) ? filemtime($path) : time();
            $url = asset('storage/branding/logo.png').'?t='.$time;
        }

        return response()->json([
            'logo_url' => $url,
        ]);
    }

    public function upload(UploadLogoRequest $request): JsonResponse
    {
        $logo = $request->file('logo');

        if (! $logo?->isValid()) {
            throw ValidationException::withMessages([
                'logo' => ['El archivo del logo no es valido.'],
            ]);
        }

        $hadLogo = Storage::disk('public')->exists('branding/logo.png');

        // Store as branding/logo.png on public disk
        $logo->storeAs('branding', 'logo.png', 'public');

        $path = Storage::disk('public')->path('branding/logo.png');
        $time = file_exists($path) ? filemtime($path) : time();
        $setting = FiscalSetting::query()->first();
        $logoUrl = asset('storage/branding/logo.png').'?t='.$time;

        AuditLog::query()->create([
            'user_id' => $request->user()->id,
            'action' => 'settings.logo.updated',
            'entity_type' => FiscalSetting::class,
            'entity_id' => $setting?->id,
            'old_values' => [
                'logo_present' => $hadLogo,
            ],
            'new_values' => [
                'logo_present' => true,
                'original_name' => $logo->getClientOriginalName(),
                'mime_type' => $logo->getMimeType(),
                'size_bytes' => $logo->getSize(),
            ],
        ]);

        return response()->json([
            'message' => 'Logo actualizado con exito.',
            'logo_url' => $logoUrl,
        ]);
    }
}
