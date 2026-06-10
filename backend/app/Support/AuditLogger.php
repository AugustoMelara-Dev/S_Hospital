<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuditLogger
{
    public static function record(
        ?int $userId,
        string $action,
        string $entityType,
        mixed $entityId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
    ): ?AuditLog {
        $context = self::context();

        try {
            return AuditLog::query()->create([
                'user_id' => $userId,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'ip' => $context['ip'],
                'user_agent' => $context['user_agent'],
                'url' => $context['url'],
                'http_method' => $context['http_method'],
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'created_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            try {
                Log::channel('daily')->error('audit_log_insert_failed', [
                    'action' => $action,
                    'entity_type' => $entityType,
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ]);
            } catch (\Throwable) {
                // best effort
            }

            return null;
        }
    }

    public static function recordFor(?Model $user, string $action, Model|string $entity, mixed $entityId = null, ?array $oldValues = null, ?array $newValues = null): ?AuditLog
    {
        $entityType = $entity instanceof Model ? $entity::class : (string) $entity;
        $resolvedId = $entityId ?? ($entity instanceof Model ? $entity->getKey() : null);

        return self::record($user?->getKey(), $action, $entityType, $resolvedId, $oldValues, $newValues);
    }

    private static function context(): array
    {
        $request = null;
        try {
            if (function_exists('request')) {
                $candidate = request();
                if ($candidate instanceof Request) { // @phpstan-ignore-line instanceof.alwaysTrue
                    $request = $candidate;
                }
            }
        } catch (\Throwable) {
        }

        if ($request === null) {
            return ['ip' => null, 'user_agent' => null, 'url' => null, 'http_method' => null];
        }

        return [
            'ip' => $request->ip() !== null ? substr((string) $request->ip(), 0, 45) : null,
            'user_agent' => substr((string) $request->userAgent(), 0, 191) ?: null,
            'url' => substr($request->getRequestUri(), 0, 255) ?: null,
            'http_method' => substr($request->getMethod(), 0, 10) ?: null,
        ];
    }
}
