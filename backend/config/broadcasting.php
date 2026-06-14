<?php

$defaultBroadcastConnection = env('BROADCAST_CONNECTION', 'log');

if (env('APP_ENV') === 'production' && $defaultBroadcastConnection === 'pusher') {
    foreach (['PUSHER_APP_ID', 'PUSHER_APP_KEY', 'PUSHER_APP_SECRET'] as $requiredPusherSecret) {
        if (blank(env($requiredPusherSecret))) {
            throw new RuntimeException("Production broadcasting requires {$requiredPusherSecret}.");
        }
    }
}

return [
    /*
    |--------------------------------------------------------------------------
    | Default Broadcaster
    |--------------------------------------------------------------------------
    |
    | The default broadcaster is used when an event is broadcast but no
    | specific driver is configured. The Soketi Pusher-compatible protocol
    | is the default in production so that the scheduler sidecar (Soketi)
    | and the cashier clients (laravel-echo + pusher-js) can exchange
    | real-time events without any cloud dependency.
    |
    | Supported: "pusher" (Soketi), "log" (development), "null" (off).
    |
    */

    'default' => $defaultBroadcastConnection,

    'connections' => [
        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER', 'mt1'),
                'host' => env('PUSHER_HOST', '127.0.0.1'),
                'port' => (int) env('PUSHER_PORT', 6001),
                'scheme' => env('PUSHER_SCHEME', 'http'),
                'encrypted' => false,
                'useTLS' => env('PUSHER_SCHEME', 'http') === 'https',
                'verify' => env('PUSHER_VERIFY_TLS', true),
            ],
            'client_options' => [
                'host' => env('PUSHER_CLIENT_HOST'),
                'port' => (int) env('PUSHER_CLIENT_PORT', env('PUSHER_PORT', 6001)),
                'scheme' => env('PUSHER_CLIENT_SCHEME', env('PUSHER_SCHEME', 'http')),
            ],
        ],

        'log' => [
            'driver' => 'log',
        ],

        'null' => [
            'driver' => 'null',
        ],
    ],
];
