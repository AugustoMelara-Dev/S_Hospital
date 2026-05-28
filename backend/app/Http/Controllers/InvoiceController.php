<?php

namespace App\Http\Controllers;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Billing\VoidInvoiceAction;
use App\Http\Requests\Billing\IndexInvoiceRequest;
use App\Http\Requests\Billing\StoreInvoiceRequest;
use App\Http\Requests\Billing\VoidInvoiceRequest;
use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceAccess $invoiceAccess) {}

    public function index(IndexInvoiceRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $invoices = Invoice::query()
            ->with([
                'issuer:id,name,username',
                'cashSession:id,user_id,status,opened_at,closed_at',
                'cashSession.user:id,name,username',
            ])
            ->when(
                ! $this->canAccessHistoricalInvoices($user),
                fn (Builder $query) => $query
                    ->where('issued_by', $user->id)
                    ->whereBetween('issued_at', [now()->startOfDay(), now()->endOfDay()]),
            )
            ->when(
                $this->canAccessHistoricalInvoices($user)
                    && empty($validated['date_from'])
                    && empty($validated['date_to']),
                fn (Builder $query) => $query->whereBetween('issued_at', [
                    now()->startOfDay(),
                    now()->endOfDay(),
                ]),
            )
            ->when(
                $this->canAccessHistoricalInvoices($user) && ! empty($validated['date_from']),
                fn (Builder $query) => $query->where('issued_at', '>=', $validated['date_from']),
            )
            ->when(
                $this->canAccessHistoricalInvoices($user) && ! empty($validated['date_to']),
                fn (Builder $query) => $query->where('issued_at', '<=', $validated['date_to'].' 23:59:59'),
            )
            ->when(! empty($validated['status']), fn (Builder $query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['patient']), function (Builder $query) use ($validated): void {
                $query->where('patient_name', 'like', '%'.$validated['patient'].'%');
            })
            ->when(! empty($validated['invoice_number']), function (Builder $query) use ($validated): void {
                $query->where('invoice_number', 'like', '%'.$validated['invoice_number'].'%');
            })
            ->when(
                $this->canAccessHistoricalInvoices($user) && ! empty($validated['user_id']),
                fn (Builder $query) => $query->where('issued_by', $validated['user_id']),
            )
            ->when(
                ! empty($validated['cash_session_id']),
                fn (Builder $query) => $query->where('cash_session_id', $validated['cash_session_id']),
            )
            ->orderByDesc('issued_at')
            ->paginate($request->perPage());

        return response()->json([
            'data' => $invoices->items(),
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'per_page' => $invoices->perPage(),
                'total' => $invoices->total(),
            ],
        ]);
    }

    public function store(StoreInvoiceRequest $request, CreateInvoiceAction $createInvoice): JsonResponse
    {
        $invoice = $createInvoice->execute($request->validated(), $request->user());

        return response()->json([
            'data' => $invoice,
        ], 201);
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorize('view', $invoice);

        return response()->json([
            'data' => $invoice->load([
                'items',
                'payments.user:id,name,username',
                'cashSession.user:id,name,username',
                'issuer:id,name,username',
                'voidedBy:id,name,username',
                'fiscalSequence',
            ]),
        ]);
    }

    public function void(
        VoidInvoiceRequest $request,
        Invoice $invoice,
        VoidInvoiceAction $voidInvoice,
    ): JsonResponse {
        $this->authorize('void', $invoice);

        return response()->json([
            'data' => $voidInvoice->execute($invoice, $request->user(), $request->reason()),
        ]);
    }

    private function authorizeInvoiceAccess(User $user, Invoice $invoice): void
    {
        if ($this->invoiceAccess->canAccessAnyInvoice($user)) {
            return;
        }

        abort_unless(
            $invoice->issued_by === $user->id && $invoice->issued_at?->isToday() === true,
            403,
        );
    }

    private function canAccessHistoricalInvoices(User $user): bool
    {
        return $this->invoiceAccess->canAccessAnyInvoice($user);
    }
}
