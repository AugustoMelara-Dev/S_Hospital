<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Cash\BuildCashReconciliationAction;
use App\Actions\Cash\CloseCashSessionAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Http\Requests\Cash\CloseCashSessionRequest;
use App\Http\Requests\Cash\CurrentCashSessionRequest;
use App\Http\Requests\Cash\IndexCashSessionRequest;
use App\Http\Requests\Cash\OpenCashSessionRequest;
use App\Models\CashRegisterSession;
use Illuminate\Http\JsonResponse;

class CashSessionController extends Controller
{
    public function current(
        CurrentCashSessionRequest $request,
        BuildCashReconciliationAction $buildCashReconciliation,
    ): JsonResponse {
        $session = CashRegisterSession::query()
            ->with('user:id,name,username')
            ->where('user_id', $request->user()->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->latest('opened_at')
            ->first();

        return response()->json([
            'data' => $session ? $this->openSessionPayload($session, $buildCashReconciliation) : null,
        ]);
    }

    public function index(IndexCashSessionRequest $request): JsonResponse
    {
        $query = CashRegisterSession::query()
            ->with('user:id,name,username')
            ->latest('opened_at');

        if (! $request->user()->can('cash.close_any')) {
            $query->where('user_id', $request->user()->id);
        } elseif ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        $sessions = $query->paginate($request->perPage());

        return response()->json([
            'data' => $sessions->items(),
            'meta' => [
                'current_page' => $sessions->currentPage(),
                'per_page' => $sessions->perPage(),
                'total' => $sessions->total(),
            ],
        ]);
    }

    public function open(OpenCashSessionRequest $request, OpenCashSessionAction $openCashSession): JsonResponse
    {
        $session = $openCashSession->execute($request->validated(), $request->user());

        return response()->json(['data' => $session], 201);
    }

    public function close(
        CloseCashSessionRequest $request,
        CashRegisterSession $cashSession,
        CloseCashSessionAction $closeCashSession,
    ): JsonResponse {
        $session = $closeCashSession->execute($cashSession, $request->validated(), $request->user());

        return response()->json(['data' => $session]);
    }

    /**
     * @return array<string, mixed>
     */
    private function openSessionPayload(
        CashRegisterSession $session,
        BuildCashReconciliationAction $buildCashReconciliation,
    ): array {
        return array_merge($session->toArray(), $buildCashReconciliation->execute($session));
    }
}
