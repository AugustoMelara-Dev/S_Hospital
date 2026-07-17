<?php

namespace App\Http\Controllers;

use App\Actions\Reports\ReportDate;
use App\Http\Requests\System\IndexAuditLogRequest;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    public function index(IndexAuditLogRequest $request): JsonResponse
    {
        $validated = $request->validatedPayload();

        $query = AuditLog::query()->with(['user:id,name,username']);

        if ($validated['action'] !== null) {
            $query->where('action', 'like', '%'.$validated['action'].'%');
        }

        if ($validated['user_id'] !== null) {
            $query->where('user_id', $validated['user_id']);
        }

        if ($validated['from'] !== null) {
            $query->where('created_at', '>=', ReportDate::day($validated['from'])->startOfDay());
        }

        if ($validated['to'] !== null) {
            $query->where('created_at', '<=', ReportDate::day($validated['to'])->endOfDay());
        }

        $perPage = max(1, min($validated['per_page'], 100));

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
            'created_at' => $log->created_at?->toIso8601String(),
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
