<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Reports\OperationalMetricsService;
use App\Http\Requests\System\ShowSystemHealthRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class HealthController extends Controller
{
    public function __construct(private readonly OperationalMetricsService $metrics) {}

    /**
     * Public liveness probe. It only confirms that the application answered
     * and reports non-sensitive status/version metadata; every operational
     * detail (queues, backups, storage, checksums, audit failures) moved to
     * detail() behind auth + system.status.view.
     */
    public function show(): JsonResponse
    {
        $version = config('app.version');

        return response()->json([
            'data' => [
                'status' => 'ok',
                'service' => 'Sistema de Caja Hospitalaria',
                'version' => is_string($version) && trim($version) !== '' ? trim($version) : 'local',
            ],
        ]);
    }

    /**
     * Authenticated operational snapshot intended for the cashier dashboard
     * and the production preflight scripts. The endpoint is read-only and
     * never exposes secrets; the metrics are scrubbed of any sensitive
     * payload by the underlying service.
     */
    public function detail(ShowSystemHealthRequest $request): JsonResponse
    {
        $snapshot = app()->environment('testing')
            ? $this->metrics->snapshot()
            : Cache::remember(
                'operational-metrics:http-snapshot',
                now()->addSeconds(15),
                fn (): array => $this->metrics->snapshot(),
            );
        $score = $this->metrics->overallHealthScore($snapshot);

        return response()->json([
            'data' => $snapshot,
            'score' => $score,
        ]);
    }
}
