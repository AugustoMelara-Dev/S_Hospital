<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class CspReportController extends Controller
{
    private const MAX_BODY_BYTES = 4096;

    public function store(Request $request): Response
    {
        $body = $request->getContent();

        if (strlen($body) > self::MAX_BODY_BYTES) {
            return response()->json([
                'message' => 'CSP report exceeds the 4KB limit.',
            ], 413);
        }

        if (! $this->isValidCspReportContentType($request)) {
            return response()->json([
                'message' => 'CSP report must use application/csp-report or application/json.',
            ], 415);
        }

        $sanitized = $this->scrub($body);

        try {
            Log::info('csp-report', [
                'remote_addr' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 191),
                'report' => $sanitized,
            ]);
        } catch (Throwable) {
            // Logging must never break the report endpoint.
        }

        return response()->json(null, 204);
    }

    private function isValidCspReportContentType(Request $request): bool
    {
        $contentType = strtolower((string) $request->headers->get('Content-Type', ''));

        return str_contains($contentType, 'application/csp-report')
            || str_contains($contentType, 'application/json');
    }

    private function scrub(string $body): string
    {
        $body = str_replace(["\r", "\n"], ' ', $body);
        $body = preg_replace('/\s+/', ' ', $body) ?? $body;
        $body = preg_replace('/(?i)(app_key|db_password|password|token|secret|authorization)\s*[:=]\s*[^\s,;\]}]+/', '$1=[redacted]', $body) ?? $body;
        $body = preg_replace('#https?://[^\s,;\]}]+#i', '[url-redacted]', $body) ?? $body;

        return substr($body, 0, 500);
    }
}
