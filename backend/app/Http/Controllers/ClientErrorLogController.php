<?php

namespace App\Http\Controllers;

use App\Http\Requests\System\StoreClientErrorLogRequest;
use App\Models\ClientErrorLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

class ClientErrorLogController extends Controller
{
    private const CONTEXT_ALLOW_LIST = [
        'action',
        'module',
        'request_id',
        'screen',
    ];

    public function store(StoreClientErrorLogRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $context = Arr::only($validated['context'] ?? [], self::CONTEXT_ALLOW_LIST);

        $log = ClientErrorLog::query()->create([
            'user_id' => $request->user()?->id,
            'event_type' => $validated['event_type'],
            'severity' => $validated['severity'],
            'safe_message' => $this->sanitize((string) $validated['safe_message']),
            'technical_code' => $validated['technical_code'] ?? null,
            'route' => $this->sanitizeRoute($validated['route'] ?? null),
            'status_code' => $validated['status_code'] ?? null,
            'context_json' => $context === [] ? null : $context,
            'occurred_at' => isset($validated['occurred_at']) ? Carbon::parse($validated['occurred_at']) : now(),
        ]);

        return response()->json([
            'data' => [
                'id' => $log->id,
            ],
        ], 201);
    }

    private function sanitize(string $value): string
    {
        $value = preg_replace('/password|contrase.{0,2}a|token|secret|APP_KEY|DB_PASSWORD/i', '[redacted]', $value) ?? $value;

        return trim(mb_substr($value, 0, 500));
    }

    private function sanitizeRoute(?string $route): ?string
    {
        if ($route === null) {
            return null;
        }

        $route = preg_replace('/\?.*$/', '', $route) ?? $route;

        return trim(mb_substr($route, 0, 180));
    }
}
