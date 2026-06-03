<?php

declare(strict_types=1);

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

    'default' => env('BROADCAST_CONNECTION', 'log'),

    'connections' => [
        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY', 'hospital-key'),
            'secret' => env('PUSHER_APP_SECRET', 'hospital-secret'),
            'app_id' => env('PUSHER_APP_ID', 'hospital-app'),
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
                // Mirror of 'options' for the JS client. laravel-echo reads
                // these from /api/system/echo-config at runtime.
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
