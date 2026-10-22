<?php

namespace App\Http\Controllers;

use App\Actions\Cash\BuildCashReconciliationAction;
use App\Actions\Cash\CloseCashSessionAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Reports\CashSessionReportService;
use App\Http\Requests\Cash\CloseCashSessionRequest;
use App\Http\Requests\Cash\ConsolidatedCashSessionRequest;
use App\Http\Requests\Cash\CurrentCashSessionRequest;
use App\Http\Requests\Cash\IndexCashSessionRequest;
use App\Http\Requests\Cash\OpenCashSessionRequest;
use App\Models\CashRegisterSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class CashSessionController extends Controller
{
    public function current(
        CurrentCashSessionRequest $request,
        BuildCashReconciliationAction $buildCashReconciliation,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);
        $validatedScope = $request->validated('scope', 'own');
        $scope = is_string($validatedScope) ? $validatedScope : 'own';
        $canViewClosableSession = $scope === 'closable' && $user->can('cash.close_any');

        $session = CashRegisterSession::query()
            ->with(['user:id,name,username', 'closedBy:id,name,username', 'cashRegister:id,code,name'])
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->when($request->filled('cash_register_id'), fn ($query) => $query->where('cash_register_id', $request->integer('cash_register_id')))
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
            ->with(['user:id,name,username', 'closedBy:id,name,username', 'cashRegister:id,code,name'])
            ->latest('opened_at');

        if (! $user->can('cash.close_any')) {
            $query->where('user_id', $user->id);
        } elseif ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('cash_register_id')) {
            $query->where('cash_register_id', $request->integer('cash_register_id'));
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
     * M-W2-FIN-02/FIN-03 + M-C1-FIN-01 (mandato §7): conciliacion consolidada
     * por caja fisica. Unidad de `consolidated` = **sesion de caja**.
     *
     * Semantica del rango (M-W2-FIN-03 H5), deliberada y alineada con
     * `ExecutiveReportService::cashSessions()`: incluye las sesiones de caja cuyo
     * `opened_at` **o** `closed_at` cae dentro del dia operativo
     * [date_from 00:00:00, date_to 23:59:59] en la zona del hospital
     * (`config('app.timezone')`, America/Tegucigalpa). Asi una sesion abierta
     * antes del rango y cerrada dentro SI se incluye, y una abierta dentro y
     * cerrada despues tambien. `consolidated` resume la conciliacion completa de
     * cada sesion incluida (no solo los movimientos del rango); `range_basis` y
     * `range_measures` lo declaran en la respuesta.
     *
     * Ambiguacion conocida y como se cubre sin cambiar la semantica: una sesion
     * abierta ANTES del rango, aun abierta y con pagos DENTRO del rango no tiene
     * `opened_at` ni `closed_at` en el periodo, asi que no aparece en
     * `consolidated` (su dinero se cuenta en el dia en que abrio y en el dia en
     * que cierre). Para responder "cobrado en el periodo" la respuesta publica
     * `payments_in_range` (`basis = payments.paid_at`, unidad = pago), un campo
     * SEPARADO que NUNCA debe sumarse con `consolidated`.
     */
    public function consolidated(
        ConsolidatedCashSessionRequest $request,
        CashSessionReportService $reports,
    ): JsonResponse {
        $dateFrom = $request->dateFrom();
        $dateTo = $request->dateTo();
        $configuredTimezone = config('app.timezone', 'America/Tegucigalpa');
        $timezone = is_string($configuredTimezone) && $configuredTimezone !== ''
            ? $configuredTimezone
            : 'America/Tegucigalpa';
        $start = Carbon::parse($dateFrom, $timezone)->startOfDay();
        $end = Carbon::parse($dateTo, $timezone)->endOfDay();

        $sessions = CashRegisterSession::query()
            ->with('cashRegister:id,code,name')
            ->where(function ($query) use ($start, $end): void {
                $query
                    ->whereBetween('opened_at', [$start, $end])
                    ->orWhereBetween('closed_at', [$start, $end]);
            })
            ->when(
                $request->filled('cash_register_id'),
                fn ($query) => $query->where('cash_register_id', $request->integer('cash_register_id')),
            )
            ->orderBy('cash_register_id')
            ->orderBy('opened_at')
            ->get();

        $cashRegisterId = $request->filled('cash_register_id')
            ? $request->integer('cash_register_id')
            : null;

        return response()->json([
            'data' => array_merge(
                $reports->consolidatedByRegister($sessions),
                [
                    'payments_in_range' => $reports->paymentsByPaidAt($start, $end, $cashRegisterId),
                    'date_from' => $dateFrom,
                    'date_to' => $dateTo,
                    'range_basis' => 'cash_sessions.opened_at_or_closed_at',
                    'range_measures' => 'cash_sessions',
                    'timezone' => $timezone,
                ],
            ),
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
