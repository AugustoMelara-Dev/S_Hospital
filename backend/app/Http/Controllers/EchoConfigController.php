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
        $configuredAppUrl = config('app.url');
        $parsedAppUrl = is_string($configuredAppUrl) ? parse_url($configuredAppUrl) : null;
        $parsed = is_array($parsedAppUrl) ? $parsedAppUrl : [];
        $scheme = $this->validScheme($parsed['scheme'] ?? null, 'http');

        $configuredPusherOptions = config('broadcasting.connections.pusher.options', []);
        $configuredClientOptions = config('broadcasting.connections.pusher.client_options', []);
        $pusherOptions = is_array($configuredPusherOptions) ? $configuredPusherOptions : [];
        $clientOptions = is_array($configuredClientOptions) ? $configuredClientOptions : [];
        $pusherScheme = $this->validScheme($pusherOptions['scheme'] ?? null, $scheme);
        $clientScheme = $this->validScheme($clientOptions['scheme'] ?? null, $pusherScheme);
        $configuredHost = $this->validHost($clientOptions['host'] ?? $pusherOptions['host'] ?? null);
        $appHost = $this->validHost($parsed['host'] ?? null);
        $pusherHost = $configuredHost !== '' && $configuredHost !== '127.0.0.1'
            ? $configuredHost
            : ($appHost !== '' ? $appHost : '127.0.0.1');
        $pusherPort = $this->validPort($clientOptions['port'] ?? $pusherOptions['port'] ?? 6001);
        $broadcastDriver = config('broadcasting.default', 'log');

        return response()->json([
            'data' => [
                'driver' => 'pusher',
                'enabled' => is_string($broadcastDriver) && $broadcastDriver === 'pusher',
                'key' => $this->stringValue(config('broadcasting.connections.pusher.key', '')),
                'cluster' => $this->stringValue($pusherOptions['cluster'] ?? 'mt1', 'mt1'),
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

    private function stringValue(mixed $value, string $default = ''): string
    {
        return is_string($value) ? $value : $default;
    }

    private function validScheme(mixed $scheme, string $default): string
    {
        return is_string($scheme) && in_array(strtolower($scheme), ['http', 'https'], true)
            ? strtolower($scheme)
            : $default;
    }

    private function validHost(mixed $host): string
    {
        if (! is_string($host)) {
            return '';
        }

        $host = trim($host);
        $unwrappedHost = str_starts_with($host, '[') && str_ends_with($host, ']')
            ? substr($host, 1, -1)
            : $host;

        if ($unwrappedHost !== '' && filter_var($unwrappedHost, FILTER_VALIDATE_IP) !== false) {
            return $unwrappedHost;
        }

        return $host !== '' && filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) !== false
            ? $host
            : '';
    }

    private function validPort(mixed $port): int
    {
        if (! is_int($port) && ! is_string($port)) {
            return 6001;
        }

        $validated = filter_var($port, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 65535],
        ]);

        return is_int($validated) ? $validated : 6001;
    }
}
