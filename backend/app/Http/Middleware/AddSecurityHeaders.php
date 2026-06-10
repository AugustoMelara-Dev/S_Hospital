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
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');

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

    private function cspFor(Request $request, string $nonce): string
    {
        $production = app()->environment('production');

        $scriptSources = $production
            ? "'self' 'nonce-{$nonce}'"
            : "'self' 'nonce-{$nonce}' 'unsafe-eval'";

        $styleSources = $production
            ? "'self' 'nonce-{$nonce}'"
            : "'self' 'nonce-{$nonce}' 'unsafe-inline'";

        $connectSources = "'self' ws: wss:";

        return implode('; ', [
            "default-src 'self'",
            "script-src {$scriptSources}",
            "style-src {$styleSources}",
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
        return implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'nonce-{$nonce}'",
            "style-src 'self' 'nonce-{$nonce}'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self' ws: wss:",
            "frame-ancestors 'none'",
            'report-uri /api/system/csp-report',
        ]);
    }
}