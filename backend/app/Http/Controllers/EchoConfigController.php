<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/**
 * Public configuration endpoint for the cashier client to bootstrap
 * laravel-echo with the correct Soketi/Pusher connection. Returns only
 * non-secret values (host, port, scheme) - the auth endpoint
 * (POST /api/broadcasting/auth) is the one that validates the user.
 *
 * In v1.0.0 PRODUCTION_READY the WebSocket is always served through
 * nginx at the same origin as the SPA. Cashier PCs never need a
 * second hostname, port, or TLS cert to reach Soketi. The host and
 * port the client receives here are derived from APP_URL so the same
 * /api/system/echo-config payload works in dev, staging, and prod.
 */
class EchoConfigController extends Controller
{
    public function show(): JsonResponse
    {
        $appUrl = (string) config('app.url');
        $parsed = parse_url($appUrl);
        $scheme = (string) ($parsed['scheme'] ?? 'http');

        $pusherOptions = config('broadcasting.connections.pusher.options', []);
        $configuredHost = (string) ($pusherOptions['host'] ?? '');

        // The host the cashier browser will reach is the APP_URL host
        // (same origin as the SPA). Soketi itself is reached over
        // nginx at /ws on that same origin.
        $clientHost = (string) ($parsed['host'] ?? '127.0.0.1');
        $clientPort = isset($parsed['port']) ? (int) $parsed['port'] : ($scheme === 'https' ? 443 : 80);
        $clientScheme = $scheme;
        $clientUseTLS = $scheme === 'https';

        // Legacy/internal Pusher config is preserved so ad-hoc tooling
        // and the tests can still talk to Soketi directly when needed
        // (never used by the cashier SPA in PRODUCTION_READY).
        $internalPort = (int) ($pusherOptions['port'] ?? 6001);
        $internalScheme = (string) ($pusherOptions['scheme'] ?? 'http');
        $internalHost = $configuredHost !== '' && $configuredHost !== '127.0.0.1'
            ? $configuredHost
            : 'soketi';

        return response()->json([
            'data' => [
                'driver' => 'pusher',
                'enabled' => (string) config('broadcasting.default', 'log') === 'pusher',
                'key' => (string) config('broadcasting.connections.pusher.key', 'hospital-key'),
                'cluster' => (string) ($pusherOptions['cluster'] ?? 'mt1'),
                // Same-origin path. The client connects ws://host/ws
                // or wss://host/ws depending on the SPA scheme.
                'host' => $clientHost,
                'port' => $clientPort,
                'scheme' => $clientScheme,
                'useTLS' => $clientUseTLS,
                'path' => '/ws',
                'authEndpoint' => '/api/broadcasting/auth',
                'channels' => [
                    'invoices' => 'invoices',
                    'cash' => 'cash',
                    'payments' => 'payments',
                    'settings' => 'settings',
                    'backups' => 'backups',
                ],
                // Internal-only metadata for tests and CLI tooling.
                '_internal' => [
                    'host' => $internalHost,
                    'port' => $internalPort,
                    'scheme' => $internalScheme,
                ],
            ],
        ]);
    }
}
