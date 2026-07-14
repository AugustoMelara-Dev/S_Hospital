<?php

namespace App\Http\Controllers;

use App\Http\Requests\System\IndexAuditLogRequest;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    public function index(IndexAuditLogRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $query = AuditLog::query()->with(['user:id,name,username']);

        if (! empty($validated['action'])) {
            $query->where('action', 'like', '%'.$validated['action'].'%');
        }

        if (! empty($validated['user_id'])) {
            $query->where('user_id', (int) $validated['user_id']);
        }

        if (! empty($validated['from'])) {
            $query->where('created_at', '>=', $validated['from'].' 00:00:00');
        }

        if (! empty($validated['to'])) {
            $query->where('created_at', '<=', $validated['to'].' 23:59:59');
        }

        $perPage = (int) ($validated['per_page'] ?? 25);
        $perPage = max(1, min($perPage, 100));

        $page = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage);

        return response()->json([
            'data' => collect($page->items())->map(fn (AuditLog $log): array => $this->payload($log))->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'result' => $log->result,
            'reason' => $log->reason,
            'ip' => $log->ip_address ?? $log->ip,
            'entity_type' => $log->entity_type,
            'entity_id' => $log->entity_id,
            'created_at' => optional($log->created_at)?->toIso8601String(),
            'user' => $log->user
                ? [
                    'id' => $log->user->id,
                    'name' => $log->user->name,
                    'username' => $log->user->username,
                ]
                : null,
        ];
    }
}
