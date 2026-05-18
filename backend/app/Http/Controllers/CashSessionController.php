<?php

namespace App\Http\Controllers;

use App\Actions\Cash\CloseCashSessionAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Http\Requests\Cash\CloseCashSessionRequest;
use App\Http\Requests\Cash\IndexCashSessionRequest;
use App\Http\Requests\Cash\OpenCashSessionRequest;
use App\Models\CashRegisterSession;
use App\Models\Payment;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CashSessionController extends Controller
{
    public function current(Request $request): JsonResponse
    {
        $request->user()->can('cash.view') || abort(403);

        $session = CashRegisterSession::query()
            ->with('user:id,name,username')
            ->where('user_id', $request->user()->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->latest('opened_at')
            ->first();

        return response()->json([
            'data' => $session ? $this->openSessionPayload($session) : null,
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
    private function openSessionPayload(CashRegisterSession $session): array
    {
        $payments = Payment::query()
            ->where('cash_session_id', $session->id)
            ->where('status', Payment::STATUS_POSTED)
            ->get();
        $paymentsByMethod = [
            Payment::METHOD_CASH => '0.00',
            Payment::METHOD_TRANSFER => '0.00',
            Payment::METHOD_CARD => '0.00',
            Payment::METHOD_OTHER => '0.00',
        ];

        foreach ($payments->groupBy('method') as $method => $methodPayments) {
            $paymentsByMethod[$method] = Money::formatCents(
                $methodPayments->sum(fn (Payment $payment): int => Money::parseCents((string) $payment->amount, 'payments')),
            );
        }

        $openingCents = Money::parseCents((string) $session->opening_amount, 'opening_amount');
        $cashCents = Money::parseCents($paymentsByMethod[Payment::METHOD_CASH], 'cash_payments');

        return array_merge($session->toArray(), [
            'payments_count' => $payments->count(),
            'payments_total' => Money::formatCents(
                $payments->sum(fn (Payment $payment): int => Money::parseCents((string) $payment->amount, 'payments')),
            ),
            'payments_by_method' => $paymentsByMethod,
            'expected_cash_amount' => Money::formatCents($openingCents + $cashCents),
        ]);
    }
}
