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

        $pusherOptions = config('broadcasting.connections.pusher.options', []);
        $pusherScheme = (string) ($pusherOptions['scheme'] ?? $scheme);
        $configuredHost = (string) ($pusherOptions['host'] ?? '');
        $pusherHost = $configuredHost !== '' && $configuredHost !== '127.0.0.1'
            ? $configuredHost
            : (string) ($parsed['host'] ?? '127.0.0.1');
        $pusherPort = (int) ($pusherOptions['port'] ?? 6001);

        return response()->json([
            'data' => [
                'driver' => 'pusher',
                'enabled' => (string) config('broadcasting.default', 'log') === 'pusher',
                'key' => (string) config('broadcasting.connections.pusher.key', 'hospital-key'),
                'cluster' => (string) ($pusherOptions['cluster'] ?? 'mt1'),
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
