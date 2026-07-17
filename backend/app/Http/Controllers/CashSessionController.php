<?php

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
use Illuminate\Support\Facades\Gate;

class CashSessionController extends Controller
{
    public function current(
        CurrentCashSessionRequest $request,
        BuildCashReconciliationAction $buildCashReconciliation,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);
        $scope = (string) ($request->validated()['scope'] ?? 'own');
        $canViewClosableSession = $scope === 'closable' && $user->can('cash.close_any');

        $session = CashRegisterSession::query()
            ->with(['user:id,name,username', 'closedBy:id,name,username'])
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->when(! $canViewClosableSession, fn ($query) => $query->where('user_id', $user->id))
            ->latest('opened_at')
            ->first();

        return response()->json([
            'data' => $session ? $this->openSessionPayload($session, $buildCashReconciliation) : null,
        ]);
    }

    public function index(IndexCashSessionRequest $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $query = CashRegisterSession::query()
            ->with(['user:id,name,username', 'closedBy:id,name,username'])
            ->latest('opened_at');

        if (! $user->can('cash.close_any')) {
            $query->where('user_id', $user->id);
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
        $session = $openCashSession->execute($request->payload(), $this->authenticatedUser($request), $request);

        return response()->json(['data' => $session], 201);
    }

    public function close(
        CloseCashSessionRequest $request,
        CashRegisterSession $cashSession,
        CloseCashSessionAction $closeCashSession,
        BuildCashReconciliationAction $buildCashReconciliation,
    ): JsonResponse {
        Gate::authorize('close', $cashSession);

        $session = $closeCashSession->execute($cashSession, $request->payload(), $this->authenticatedUser($request), $request);

        return response()->json([
            'data' => $this->closedSessionPayload($session, $buildCashReconciliation),
        ]);
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

    /**
     * @return array<string, mixed>
     */
    private function closedSessionPayload(
        CashRegisterSession $session,
        BuildCashReconciliationAction $buildCashReconciliation,
    ): array {
        $reconciliation = $buildCashReconciliation->execute($session);
        $methods = $session->method_totals_snapshot ?? $reconciliation['payments_by_method'];

        return array_merge($session->toArray(), [
            'payments_count' => $session->payments_count_snapshot ?? $reconciliation['payments_count'],
            'payments_total' => (string) ($session->payments_total_snapshot ?? $reconciliation['payments_total']),
            'payments_by_method' => $methods,
            'expected_cash_amount' => (string) ($session->expected_amount ?? $reconciliation['expected_cash_amount']),
            'pending_invoice_count' => $session->pending_invoice_count_snapshot ?? $reconciliation['pending_invoice_count'],
            'pending_amount' => (string) ($session->pending_amount_snapshot ?? $reconciliation['pending_amount']),
            'missing_institutional_receipt_count' => $reconciliation['missing_institutional_receipt_count'],
            'reversed_payments_count' => $reconciliation['reversed_payments_count'],
            'reversed_payments_total' => $reconciliation['reversed_payments_total'],
        ]);
    }
}
