<?php

namespace App\Http\Controllers;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Billing\ReverseInvoiceAction;
use App\Actions\Billing\VoidInvoiceAction;
use App\Http\Requests\Billing\IndexInvoiceRequest;
use App\Http\Requests\Billing\ReverseInvoiceRequest;
use App\Http\Requests\Billing\ShowInvoiceRequest;
use App\Http\Requests\Billing\StoreInvoiceRequest;
use App\Http\Requests\Billing\VoidInvoiceRequest;
use App\Models\InstitutionalReceipt;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceAccess $invoiceAccess) {}

    public function index(IndexInvoiceRequest $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $validated = $request->validated();
        $reconciliationCashSessionId = $validated['reconciliation_cash_session_id'] ?? null;

        $invoices = Invoice::query()
            ->with([
                'issuer:id,name,username',
                'cashSession:id,user_id,status,opened_at,closed_at',
                'cashSession.user:id,name,username',
                'issuedInstitutionalReceipts:id,invoice_id,receipt_number_full,status,reprint_count,issued_at',
                'issuedInstitutionalReceipts.printEvents:id,institutional_receipt_id',
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
                    && empty($validated['date_to'])
                    && empty($reconciliationCashSessionId),
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
                $query->where('patient_name', 'like', '%'.$this->escapeLike($validated['patient']).'%');
            })
            ->when(! empty($validated['invoice_number']), function (Builder $query) use ($validated): void {
                $query->where('invoice_number', 'like', '%'.$this->escapeLike($validated['invoice_number']).'%');
            })
            ->when(
                $this->canAccessHistoricalInvoices($user) && ! empty($validated['user_id']),
                fn (Builder $query) => $query->where('issued_by', $validated['user_id']),
            )
            ->when(
                ! empty($validated['cash_session_id']),
                fn (Builder $query) => $query->where('cash_session_id', $validated['cash_session_id']),
            )
            ->when(
                ! empty($reconciliationCashSessionId),
                function (Builder $query) use ($reconciliationCashSessionId): void {
                    $query->where(function (Builder $scope) use ($reconciliationCashSessionId): void {
                        $scope
                            ->where('cash_session_id', $reconciliationCashSessionId)
                            ->orWhereExists(function ($paymentQuery) use ($reconciliationCashSessionId): void {
                                $paymentQuery
                                    ->selectRaw('1')
                                    ->from('payments')
                                    ->whereColumn('payments.invoice_id', 'invoices.id')
                                    ->where('payments.cash_session_id', $reconciliationCashSessionId)
                                    ->where('payments.status', Payment::STATUS_POSTED);
                            });
                    });
                },
            )
            ->when(
                ($validated['balance_state'] ?? null) === 'pending',
                fn (Builder $query) => $query->whereIn('status', [
                    Invoice::STATUS_ISSUED,
                    Invoice::STATUS_PARTIAL,
                ]),
            )
            ->when(
                ($validated['receipt_state'] ?? null) === 'missing',
                function (Builder $query): void {
                    $query
                        ->where('status', Invoice::STATUS_PAID)
                        ->whereNotExists(function ($receiptQuery): void {
                            $receiptQuery
                                ->selectRaw('1')
                                ->from('institutional_receipts')
                                ->whereColumn('institutional_receipts.invoice_id', 'invoices.id')
                                ->where('institutional_receipts.status', InstitutionalReceipt::STATUS_ISSUED);
                        });
                },
            )
            ->orderByDesc('issued_at')
            ->paginate($request->perPage());

        return response()->json([
            'data' => $this->withInstitutionalReceiptSummary($invoices->items()),
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'per_page' => $invoices->perPage(),
                'total' => $invoices->total(),
            ],
        ]);
    }

    public function store(StoreInvoiceRequest $request, CreateInvoiceAction $createInvoice): JsonResponse
    {
        $invoice = $createInvoice->execute($request->payload(), $this->authenticatedUser($request), $request);

        return response()->json([
            'data' => $this->withInstitutionalReceiptSummary($invoice),
        ], 201);
    }

    public function show(ShowInvoiceRequest $request, Invoice $invoice): JsonResponse
    {
        return response()->json([
            'data' => $this->withInstitutionalReceiptSummary($invoice->load([
                'items',
                'payments.user:id,name,username',
                'cashSession.user:id,name,username',
                'issuer:id,name,username',
                'voidedBy:id,name,username',
                'issuedInstitutionalReceipts:id,invoice_id,receipt_number_full,status,reprint_count,issued_at',
                'issuedInstitutionalReceipts.printEvents:id,institutional_receipt_id',
            ])),
        ]);
    }

    public function void(
        VoidInvoiceRequest $request,
        Invoice $invoice,
        VoidInvoiceAction $voidInvoice,
    ): JsonResponse {
        Gate::authorize('void', $invoice);

        return response()->json([
            'data' => $this->withInstitutionalReceiptSummary(
                $voidInvoice->execute($invoice, $this->authenticatedUser($request), $request->reason())
            ),
        ]);
    }

    public function reverse(
        ReverseInvoiceRequest $request,
        Invoice $invoice,
        ReverseInvoiceAction $reverseInvoice,
    ): JsonResponse {
        Gate::authorize('reverse', $invoice);

        return response()->json([
            'data' => $this->withInstitutionalReceiptSummary(
                $reverseInvoice->execute($invoice, $this->authenticatedUser($request), $request->reason())
            ),
        ]);
    }

    /**
     * @param  Invoice|array<int, Invoice>|Collection<int, Invoice>  $invoices
     * @return Invoice|array<int, Invoice>|Collection<int, Invoice>
     */
    private function withInstitutionalReceiptSummary(Invoice|array|Collection $invoices): Invoice|array|Collection
    {
        if ($invoices instanceof Invoice) {
            return $this->attachInstitutionalReceiptSummary($invoices);
        }

        foreach ($invoices as $invoice) {
            $this->attachInstitutionalReceiptSummary($invoice);
        }

        return $invoices;
    }

    private function attachInstitutionalReceiptSummary(Invoice $invoice): Invoice
    {
        $invoice->unsetRelation('fiscalSequence');

        if (! $invoice->relationLoaded('issuedInstitutionalReceipts')) {
            $invoice->load([
                'issuedInstitutionalReceipts:id,invoice_id,receipt_number_full,status,reprint_count,issued_at',
                'issuedInstitutionalReceipts.printEvents:id,institutional_receipt_id',
            ]);
        }

        $receipt = $invoice->getRelation('issuedInstitutionalReceipts')->first();
        $invoice->unsetRelation('issuedInstitutionalReceipts');
        $invoice->setAttribute('institutional_receipt', $receipt instanceof InstitutionalReceipt ? [
            'id' => $receipt->id,
            'receipt_number_full' => $receipt->receipt_number_full,
            'status' => $receipt->status,
            'reprint_count' => $receipt->reprint_count,
            'print_events_count' => $receipt->relationLoaded('printEvents') ? $receipt->printEvents->count() : 0,
            'has_print_events' => $receipt->relationLoaded('printEvents') && $receipt->printEvents->isNotEmpty(),
            'issued_at' => $receipt->issued_at?->toISOString(),
        ] : null);

        return $invoice;
    }

    private function canAccessHistoricalInvoices(User $user): bool
    {
        return $this->invoiceAccess->canAccessAnyInvoice($user);
    }

    private function escapeLike(string $input): string
    {
        return str_replace(['%', '_'], ['\\%', '\\_'], $input);
    }
}
