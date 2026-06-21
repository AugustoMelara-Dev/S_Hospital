<?php

declare(strict_types=1);

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Throwable;

/**
 * Records permission and role administration changes without exposing secrets.
 */
class PermissionAuditObserver
{
    public function created(Role|Permission $model): void
    {
        $this->record('created', $model, [
            'name' => $model->name,
            'guard_name' => $model->guard_name,
        ]);
    }

    public function updated(Role|Permission $model): void
    {
        $this->record('updated', $model, $this->diff($model));
    }

    public function deleted(Role|Permission $model): void
    {
        $this->record('deleted', $model, [
            'name' => $model->name ?? null,
            'guard_name' => $model->guard_name ?? null,
        ]);
    }

    public function rolesAttached(Model $model, mixed $rolesOrIds): void
    {
        foreach ($this->normalizeItems($rolesOrIds) as $roleOrId) {
            $this->recordRoleChange($model, 'role.attached', $roleOrId);
        }
    }

    public function rolesDetached(Model $model, mixed $rolesOrIds): void
    {
        foreach ($this->normalizeItems($rolesOrIds) as $roleOrId) {
            $this->recordRoleChange($model, 'role.detached', $roleOrId);
        }
    }

    public function permissionsAttached(Model $model, mixed $permissionsOrIds): void
    {
        foreach ($this->normalizeItems($permissionsOrIds) as $permissionOrId) {
            $this->recordPermissionChange($model, 'permission.attached', $permissionOrId);
        }
    }

    public function permissionsDetached(Model $model, mixed $permissionsOrIds): void
    {
        foreach ($this->normalizeItems($permissionsOrIds) as $permissionOrId) {
            $this->recordPermissionChange($model, 'permission.detached', $permissionOrId);
        }
    }

    /**
     * @return list<mixed>
     */
    private function normalizeItems(mixed $items): array
    {
        if ($items instanceof Collection) {
            return $items->values()->all();
        }

        if (is_array($items)) {
            return array_values($items);
        }

        return [$items];
    }

    private function recordRoleChange(Model $model, string $action, mixed $roleOrId): void
    {
        $role = $roleOrId instanceof Role ? $roleOrId : Role::query()->find($roleOrId);
        $this->write($action, $model::class, $model->getKey(), [
            'role_id' => $role?->getKey() ?? $roleOrId,
            'role_name' => $role?->name,
        ]);
    }

    private function recordPermissionChange(Model $model, string $action, mixed $permissionOrId): void
    {
        $permission = $permissionOrId instanceof Permission ? $permissionOrId : Permission::query()->find($permissionOrId);
        $this->write($action, $model::class, $model->getKey(), [
            'permission_id' => $permission?->getKey() ?? $permissionOrId,
            'permission_name' => $permission?->name,
        ]);
    }

    private function record(string $action, Model $model, ?array $payload = null): void
    {
        $this->write($action, $model::class, $model->getKey(), $payload);
    }

    /**
     * @return array<string, mixed>
     */
    private function diff(Model $model): array
    {
        $changes = $model->getChanges();
        $safe = [];

        foreach ($changes as $key => $value) {
            if (in_array($key, ['password', 'remember_token', 'updated_at'], true)) {
                continue;
            }

            $safe[$key] = $value;
        }

        return $safe;
    }

    private function write(string $action, string $entityType, mixed $entityId, ?array $newValues): void
    {
        try {
            AuditLog::query()->create([
                'user_id' => $this->currentUserId(),
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'old_values' => null,
                'new_values' => $newValues,
                'created_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $this->reportAuditFailure($action, $entityType, $entityId, $exception);
        }
    }

    private function reportAuditFailure(string $action, string $entityType, mixed $entityId, Throwable $exception): void
    {
        $context = [
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'exception' => $exception::class,
        ];

        Log::warning('Permission audit write failed', $context);

        Cache::put('permission_audit_observer:last_failure', [
            ...$context,
            'failed_at' => now()->toIso8601String(),
        ], now()->addDay());
    }

    private function currentUserId(): ?int
    {
        try {
            $user = auth()->user();

            return $user !== null ? (int) $user->getAuthIdentifier() : null;
        } catch (Throwable) {
            return null;
        }
    }
}
