<?php

$allowedOrigins = array_filter(array_map('trim', explode(',', env(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173'
))));

$allowedOriginPatterns = array_filter(array_map('trim', explode(',', env(
    'CORS_ALLOWED_ORIGIN_PATTERNS',
    ''
))));

if (env('APP_ENV') === 'production') {
    if (in_array('*', $allowedOrigins, true) || $allowedOriginPatterns !== []) {
        throw new RuntimeException('Production CORS must use explicit LAN origins without wildcard patterns.');
    }
}

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Production LAN should prefer same-origin delivery from Laravel. These
    | defaults only unblock local Vite development while still requiring an
    | explicit origin match for credentialed Sanctum requests.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowedOrigins,

    'allowed_origins_patterns' => $allowedOriginPatterns,

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
