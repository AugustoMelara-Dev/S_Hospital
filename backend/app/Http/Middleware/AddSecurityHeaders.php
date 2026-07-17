<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AddSecurityHeaders
{
    public const NONCE_ATTRIBUTE = 's_hospital.csp_nonce';

    public function handle(Request $request, Closure $next): Response
    {
        $nonce = $this->generateNonce();
        $request->attributes->set(self::NONCE_ATTRIBUTE, $nonce);

        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'same-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        if ($this->shouldPreventIndexing($request, $response)) {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow, noarchive');
        }
        if ($this->canUseCrossOriginOpenerPolicy($request)) {
            $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        }

        if ($this->isProductionLike() && $request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // JSON responses for authenticated routes carry PII (patient names,
        // totals, payment references). They MUST NOT be cached by browsers,
        // proxies, or shared caches. The SPA also relies on this for the
        // cashier app to never serve stale financial data.
        if ($this->isApiResponse($request, $response)) {
            $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            $response->headers->set('Pragma', 'no-cache');
            $response->headers->set('Expires', '0');
        }

        if (! $response->headers->has('Content-Security-Policy')) {
            $response->headers->set('Content-Security-Policy', $this->cspFor($request, $nonce));
        }

        if (! $response->headers->has('Content-Security-Policy-Report-Only')) {
            $response->headers->set('Content-Security-Policy-Report-Only', $this->reportOnlyCsp($nonce));
        }

        return $response;
    }

    private function generateNonce(): string
    {
        return bin2hex(random_bytes(16));
    }

    /**
     * True when APP_ENV is exactly "production" (case-insensitive, trimmed).
     * We accept any case to prevent a Windows install with `APP_ENV=Production`
     * from silently falling into the dev branch with `unsafe-eval`.
     */
    private function isProductionLike(): bool
    {
        $runtimeEnv = $this->normalizedEnvironment(app()->environment());
        $configuredEnv = $this->normalizedEnvironment(config('app.env'));

        return in_array($runtimeEnv, ['production', 'prod'], true)
            || in_array($configuredEnv, ['production', 'prod'], true);
    }

    private function shouldPreventIndexing(Request $request, Response $response): bool
    {
        if ($request->is('api/*')) {
            return true;
        }

        return str_contains(strtolower((string) $response->headers->get('Content-Type', '')), 'text/html');
    }

    private function canUseCrossOriginOpenerPolicy(Request $request): bool
    {
        if ($request->isSecure()) {
            return true;
        }

        $host = strtolower((string) $request->getHost());

        return in_array($host, ['localhost', '127.0.0.1', '::1'], true);
    }

    private function isApiResponse(Request $request, Response $response): bool
    {
        if ($request->is('api/*')) {
            $cacheControl = strtolower((string) $response->headers->get('Cache-Control', ''));
            if (str_contains($cacheControl, 'public')) {
                return false;
            }

            return true;
        }

        $accept = (string) $request->headers->get('Accept', '');

        return str_contains($accept, 'application/json');
    }

    private function cspFor(Request $request, string $nonce): string
    {
        $production = $this->isProductionLike();

        $scriptSources = $production
            ? "'self' 'nonce-{$nonce}'"
            : "'self' 'nonce-{$nonce}' 'unsafe-eval'";

        $styleSources = "'self' 'unsafe-inline'";
        $styleElementSources = "'self' 'unsafe-inline'";

        $connectSources = implode(' ', $this->connectSources());

        return implode('; ', [
            "default-src 'self'",
            "script-src {$scriptSources}",
            "style-src {$styleSources}",
            "style-src-elem {$styleElementSources}",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src {$connectSources}",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
            "manifest-src 'self'",
        ]);
    }

    private function reportOnlyCsp(string $nonce): string
    {
        $styleSources = "'self' 'unsafe-inline'";
        $styleElementSources = "'self' 'unsafe-inline'";

        return implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'nonce-{$nonce}'",
            "style-src {$styleSources}",
            "style-src-elem {$styleElementSources}",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            'connect-src '.implode(' ', $this->connectSources()),
            "frame-ancestors 'none'",
            'report-uri /api/system/csp-report',
        ]);
    }

    /**
     * @return list<string>
     */
    private function connectSources(): array
    {
        $sources = ["'self'"];
        $appUrl = config('app.url');
        $parsedAppHost = is_string($appUrl) ? parse_url($appUrl, PHP_URL_HOST) : null;
        $appHost = is_string($parsedAppHost) ? $parsedAppHost : null;
        $configuredClientOptions = config('broadcasting.connections.pusher.client_options', []);
        $configuredPusherOptions = config('broadcasting.connections.pusher.options', []);
        $clientOptions = is_array($configuredClientOptions) ? $configuredClientOptions : [];
        $pusherOptions = is_array($configuredPusherOptions) ? $configuredPusherOptions : [];
        $host = $this->validConnectHost($clientOptions['host'] ?? $pusherOptions['host'] ?? $appHost);
        $port = $this->validConnectPort($clientOptions['port'] ?? $pusherOptions['port'] ?? 6001);

        if ($host !== '') {
            $authorityHost = str_contains($host, ':') && ! str_starts_with($host, '[')
                ? "[{$host}]"
                : $host;
            $authority = "{$authorityHost}:{$port}";
            $sources[] = "ws://{$authority}";
            $sources[] = "wss://{$authority}";
        }

        return array_values(array_unique($sources));
    }

    private function normalizedEnvironment(mixed $environment): string
    {
        return is_string($environment) ? strtolower(trim($environment)) : '';
    }

    private function validConnectHost(mixed $host): string
    {
        if (! is_string($host)) {
            return '';
        }

        $host = trim($host);
        if ($host === '') {
            return '';
        }

        $unwrappedHost = str_starts_with($host, '[') && str_ends_with($host, ']')
            ? substr($host, 1, -1)
            : $host;

        if (filter_var($unwrappedHost, FILTER_VALIDATE_IP) !== false) {
            return $unwrappedHost;
        }

        return filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) !== false
            ? $host
            : '';
    }

    private function validConnectPort(mixed $port): int
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
