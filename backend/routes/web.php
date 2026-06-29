<?php

use App\Http\Middleware\AddSecurityHeaders;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

$statelessWebMiddleware = [
    AddQueuedCookiesToResponse::class,
    ValidateCsrfToken::class,
    VerifyCsrfToken::class,
    StartSession::class,
    ShareErrorsFromSession::class,
];

Route::get('/up', function () {
    DB::connection()->getPdo();

    return response()->json([
        'status' => 'ok',
        'service' => 'Sistema de Caja Hospitalaria',
        'database' => 'ok',
    ]);
})->withoutMiddleware($statelessWebMiddleware);

$frontendResponse = function () {
    $indexPath = base_path('../frontend/dist/index.html');

    if (! File::isFile($indexPath)) {
        return response(
            'Frontend build missing. Run npm.cmd run build in frontend/ before production LAN validation.',
            503,
            ['Content-Type' => 'text/plain; charset=UTF-8'],
        );
    }

    $nonce = (string) request()->attributes->get(
        AddSecurityHeaders::NONCE_ATTRIBUTE,
        bin2hex(random_bytes(16)),
    );

    $html = File::get($indexPath);
    $html = str_replace('__S_HOSPITAL_CSP_NONCE__', $nonce, $html);

    return response($html, 200, [
        'Cache-Control' => 'no-store',
        'Content-Type' => 'text/html; charset=UTF-8',
        'X-Content-Type-Options' => 'nosniff',
    ]);
};

$frontendStaticResponse = function (string $relativePath, string $contentType) {
    abort_if(str_contains($relativePath, '..') || str_contains($relativePath, '\\'), 404);

    $assetPath = base_path('../frontend/dist/'.$relativePath);
    abort_unless(File::isFile($assetPath), 404);

    return response()->file($assetPath, [
        'Cache-Control' => 'public, max-age=86400',
        'Content-Type' => $contentType,
        'X-Content-Type-Options' => 'nosniff',
    ]);
};

Route::withoutMiddleware($statelessWebMiddleware)->group(function () use ($frontendResponse, $frontendStaticResponse) {
    Route::get('/', $frontendResponse);

    Route::get('/login', $frontendResponse);
    Route::get('/verify-email', $frontendResponse);
    Route::get('/dashboard', $frontendResponse);
    Route::get('/billing/new', $frontendResponse);
    Route::get('/cashbox', $frontendResponse);
    Route::get('/catalog', $frontendResponse);
    Route::get('/invoices', $frontendResponse);
    Route::get('/reports', $frontendResponse);
    Route::get('/backups', $frontendResponse);
    Route::get('/help', $frontendResponse);
    Route::get('/support', $frontendResponse);
    Route::get('/about', $frontendResponse);
    Route::get('/settings/fiscal', $frontendResponse);
    Route::get('/settings/institutional-receipts', $frontendResponse);
    Route::get('/admin/users', $frontendResponse);

    Route::get(
        '/manifest.webmanifest',
        fn () => $frontendStaticResponse('manifest.webmanifest', 'application/manifest+json; charset=UTF-8'),
    );

    Route::get('/icons/{path}', function (string $path) use ($frontendStaticResponse) {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $contentType = match ($extension) {
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'ico' => 'image/x-icon',
            default => 'application/octet-stream',
        };

        return $frontendStaticResponse('icons/'.$path, $contentType);
    })->where('path', '.*');

    Route::get('/assets/{path}', function (string $path) {
        abort_if(str_contains($path, '..') || str_contains($path, '\\'), 404);

        $assetPath = base_path('../frontend/dist/assets/'.$path);
        abort_unless(File::isFile($assetPath), 404);

        $extension = strtolower(pathinfo($assetPath, PATHINFO_EXTENSION));
        $contentType = match ($extension) {
            'css' => 'text/css; charset=UTF-8',
            'js', 'mjs' => 'text/javascript; charset=UTF-8',
            'json', 'map' => 'application/json; charset=UTF-8',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'ico' => 'image/x-icon',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
            default => File::mimeType($assetPath) ?: 'application/octet-stream',
        };

        return response()->file($assetPath, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Content-Type' => $contentType,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    })->where('path', '.*');

    Route::get('/{path}', $frontendResponse)
        ->where('path', '^(?!api(?:/|$)|sanctum(?:/|$)|assets(?:/|$)|icons(?:/|$)|manifest\.webmanifest$|up$)(?!.*\.[A-Za-z0-9]{1,8}$).*$');
});
