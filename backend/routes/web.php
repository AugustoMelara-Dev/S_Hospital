<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;

$frontendResponse = function () {
    $indexPath = base_path('../frontend/dist/index.html');

    if (! File::isFile($indexPath)) {
        return response(
            'Frontend build missing. Run npm.cmd run build in frontend/ before production LAN validation.',
            503,
            ['Content-Type' => 'text/plain; charset=UTF-8'],
        );
    }

    return response()->file($indexPath, [
        'Cache-Control' => 'no-store',
        'X-Content-Type-Options' => 'nosniff',
    ]);
};

Route::get('/', $frontendResponse);

Route::get('/login', $frontendResponse);
Route::get('/verify-email', $frontendResponse);

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
