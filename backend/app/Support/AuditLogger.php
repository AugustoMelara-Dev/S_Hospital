<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public static function log(
        string $action,
        Model|string $entity,
        ?int $entityId = null,
        ?User $user = null,
        ?Request $request = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $reason = null,
        string $result = 'success',
    ): AuditLog {
        if ($entity instanceof Model) {
            $entityType = $entity::class;
            $entityId ??= $entity->getKey();
        } else {
            $entityType = $entity;
        }

        $user ??= $request?->user();

        return AuditLog::query()->create([
            'user_id' => $user?->id,
            'action' => $action,
            'result' => $result,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'reason' => $reason,
            'ip' => $request?->ip(),
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'url' => $request?->fullUrl(),
            'http_method' => $request?->method(),
            'created_at' => now(),
        ]);
    }
}
