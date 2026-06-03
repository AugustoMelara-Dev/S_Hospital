<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Reports\OperationalMetricsService;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function __construct(private readonly OperationalMetricsService $metrics) {}

    /**
     * Lightweight health snapshot intended for the cashier dashboard
     * and the production preflight scripts. The endpoint is read-only
     * and never exposes secrets; the metrics are scrubbed of any
     * sensitive payload by the underlying service.
     */
    public function show(): JsonResponse
    {
        $snapshot = $this->metrics->snapshot();
        $score = $this->metrics->overallHealthScore();

        return response()->json([
            'data' => $snapshot,
            'score' => $score,
        ]);
    }
}
