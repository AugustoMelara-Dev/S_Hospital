<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AddSecurityHeaders
{
    /**
     * Default CSP used outside of production. Production builds rely
     * on the same directives plus a per-request nonce once the Vite
     * pipeline is configured to inject the nonce into the entry
     * script and the inline styles emitted by Tailwind. Until then
     * the cashier app needs `unsafe-inline` for the entry script.
     */
    private const FALLBACK_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'same-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        if (! $response->headers->has('Content-Security-Policy')) {
            $response->headers->set('Content-Security-Policy', $this->cspFor($request));
        }

        if (! $response->headers->has('Content-Security-Policy-Report-Only')) {
            $response->headers->set('Content-Security-Policy-Report-Only', $this->reportOnlyCsp());
        }

        return $response;
    }

    private function cspFor(Request $request): string
    {
        $production = app()->environment('production');

        $scriptSources = $production
            ? "'self' 'unsafe-inline'"
            : "'self' 'unsafe-inline' 'unsafe-eval'";

        $connectSources = "'self' ws: wss:";

        return implode('; ', [
            "default-src 'self'",
            "script-src {$scriptSources}",
            "style-src 'self' 'unsafe-inline'",
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

    private function reportOnlyCsp(): string
    {
        return implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "report-uri /api/system/csp-report",
        ]);
    }
}
