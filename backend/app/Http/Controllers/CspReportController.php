<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class CspReportController extends Controller
{
    /**
     * Accept CSP violation reports from the browser. The endpoint
     * never echoes the payload back to the client; the body is
     * sanitized, logged and acknowledged with 204.
     */
    public function store(Request $request): JsonResponse
    {
        $body = $request->getContent();
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

    private function scrub(string $body): string
    {
        $body = str_replace(["\r", "\n"], ' ', $body);
        $body = preg_replace('/\s+/', ' ', $body) ?? $body;

        return substr($body, 0, 500);
    }
}
