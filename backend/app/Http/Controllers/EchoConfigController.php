<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/**
 * Public configuration endpoint for the cashier client to bootstrap
 * laravel-echo with the correct Soketi/Pusher connection. Returns only
 * non-secret values (host, port, scheme) - the auth endpoint
 * (POST /api/broadcasting/auth) is the one that validates the user.
 */
class EchoConfigController extends Controller
{
    public function show(): JsonResponse
    {
        $appUrl = (string) config('app.url');
        $parsed = parse_url($appUrl);
        $scheme = (string) ($parsed['scheme'] ?? 'http');

        $pusherScheme = (string) env('PUSHER_SCHEME', $scheme);
        $pusherHost = (string) env('PUSHER_HOST', $parsed['host'] ?? '127.0.0.1');
        $pusherPort = (int) env('PUSHER_PORT', 6001);

        return response()->json([
            'data' => [
                'driver' => 'pusher',
                'enabled' => (string) env('BROADCAST_CONNECTION', 'log') === 'pusher',
                'key' => (string) env('PUSHER_APP_KEY', 'hospital-key'),
                'cluster' => (string) env('PUSHER_APP_CLUSTER', 'mt1'),
                'host' => $pusherHost,
                'port' => $pusherPort,
                'scheme' => $pusherScheme,
                'useTLS' => $pusherScheme === 'https',
                'authEndpoint' => '/api/broadcasting/auth',
                'channels' => [
                    'invoices' => 'invoices',
                    'cash' => 'cash',
                    'payments' => 'payments',
                    'settings' => 'settings',
                    'backups' => 'backups',
                ],
            ],
        ]);
    }
}
