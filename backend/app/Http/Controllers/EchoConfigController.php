<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/**
 * Public configuration endpoint for the cashier client to bootstrap
 * laravel-echo with the correct Soketi/Pusher connection. Returns only
 * non-secret values (host, port, scheme). The private-channel auth endpoint
 * (POST /broadcasting/auth) is registered by Laravel and validates the user.
 */
class EchoConfigController extends Controller
{
    public function show(): JsonResponse
    {
        $appUrl = (string) config('app.url');
        $parsed = parse_url($appUrl);
        $scheme = (string) ($parsed['scheme'] ?? 'http');

        $pusherOptions = config('broadcasting.connections.pusher.options', []);
        $clientOptions = config('broadcasting.connections.pusher.client_options', []);
        $pusherScheme = (string) ($pusherOptions['scheme'] ?? $scheme);
        $clientScheme = (string) ($clientOptions['scheme'] ?? $pusherScheme);
        $configuredHost = (string) ($clientOptions['host'] ?? $pusherOptions['host'] ?? '');
        $pusherHost = $configuredHost !== '' && $configuredHost !== '127.0.0.1'
            ? $configuredHost
            : (string) ($parsed['host'] ?? '127.0.0.1');
        $pusherPort = (int) ($clientOptions['port'] ?? $pusherOptions['port'] ?? 6001);

        return response()->json([
            'data' => [
                'driver' => 'pusher',
                'enabled' => (string) config('broadcasting.default', 'log') === 'pusher',
                'key' => (string) config('broadcasting.connections.pusher.key', ''),
                'cluster' => (string) ($pusherOptions['cluster'] ?? 'mt1'),
                'host' => $pusherHost,
                'port' => $pusherPort,
                'scheme' => $clientScheme,
                'useTLS' => $clientScheme === 'https',
                'authEndpoint' => '/broadcasting/auth',
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
