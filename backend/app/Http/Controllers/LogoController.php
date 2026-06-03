<?php

namespace App\Http\Controllers;

use App\Http\Requests\Fiscal\UploadLogoRequest;
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
            'logo_url' => asset('storage/branding/logo.png').'?t='.$time,
        ]);
    }
}
