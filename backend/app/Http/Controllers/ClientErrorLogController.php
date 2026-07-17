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
        $user = $this->authenticatedUser($request);
        $validatedContext = $request->validated('context');
        $context = is_array($validatedContext)
            ? Arr::only($validatedContext, self::CONTEXT_ALLOW_LIST)
            : [];
        $technicalCode = $request->filled('technical_code')
            ? $request->string('technical_code')->toString()
            : null;
        $route = $request->filled('route')
            ? $request->string('route')->toString()
            : null;
        $statusCode = $request->input('status_code') === null
            ? null
            : $request->integer('status_code');
        $occurredAt = $request->filled('occurred_at')
            ? Carbon::parse($request->string('occurred_at')->toString())
            : now();

        $log = ClientErrorLog::query()->create([
            'user_id' => $user->id,
            'event_type' => $request->string('event_type')->toString(),
            'severity' => $request->string('severity')->toString(),
            'safe_message' => $this->sanitize($request->string('safe_message')->toString()),
            'technical_code' => $technicalCode,
            'route' => $this->sanitizeRoute($route),
            'status_code' => $statusCode,
            'context_json' => $context === [] ? null : $context,
            'occurred_at' => $occurredAt,
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
