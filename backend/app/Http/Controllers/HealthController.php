<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Reports\OperationalMetricsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class HealthController extends Controller
{
    /**
     * Cache the expensive health probe for 10 seconds. The cashier
     * dashboard polls this endpoint every 30s, but production
     * preflight scripts also call it from multiple PC clients in a
     * tight loop. Without this cache the endpoint makes 4-5 DB
     * queries on every call; with it, the dashboard and preflight
     * scripts share a single snapshot.
     */
    private const CACHE_TTL_SECONDS = 10;

    private const CACHE_KEY = 'health:snapshot:v1';

    public function __construct(private readonly OperationalMetricsService $metrics) {}

    /**
     * Lightweight health snapshot intended for the cashier dashboard
     * and the production preflight scripts. The endpoint is read-only
     * and never exposes secrets; the metrics are scrubbed of any
     * sensitive payload by the underlying service.
     */
    public function show(): JsonResponse
    {
        $cached = Cache::store($this->cacheStore())->get(self::CACHE_KEY);

        if (is_array($cached)) {
            return response()->json($cached);
        }

        $payload = [
            'data' => $this->metrics->snapshot(),
            'score' => $this->metrics->overallHealthScore(),
        ];

        Cache::store($this->cacheStore())->put(self::CACHE_KEY, $payload, self::CACHE_TTL_SECONDS);

        return response()->json($payload);
    }

    /**
     * Use the file cache in production to avoid hammering the
     * database session table. The `array` cache is used in tests
     * where the file store is not always available.
     */
    private function cacheStore(): ?string
    {
        if (app()->environment('testing')) {
            return 'array';
        }

        return 'file';
    }
}
