<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Billing\PatientSummaryRequest;
use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PatientInvoiceController extends Controller
{
    public function __construct(private readonly InvoiceAccess $invoiceAccess) {}

    /**
     * Aggregated cross-invoice view for a patient name. There is no
     * patient entity in the system (AGENTS.md keeps the patient
     * surface inside the invoice record only), so the name acts as
     * the natural key and the response reuses the existing
     * /api/invoices index shape for the line list.
     */
    public function summary(PatientSummaryRequest $request): JsonResponse
    {
        $user = $request->user();
        $name = $request->patientName();

        if ($name === '') {
            return response()->json([
                'data' => $this->emptySummary(''),
            ], 422);
        }

        $accessHistorical = $this->invoiceAccess->canAccessAnyInvoice($user);
        $visibility = $this->visibilityScope($user, $accessHistorical);

        $invoices = Invoice::query()
            ->with([
                'issuer:id,name,username',
                'cashSession:id,user_id,status,opened_at,closed_at',
                'cashSession.user:id,name,username',
            ])
            ->where('patient_name', $name)
            ->when($visibility !== null, fn (Builder $query) => $query->where($visibility['column'], $visibility['value']))
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        $totalsQuery = DB::table('invoices')
            ->where('patient_name', $name)
            ->where('status', '!=', Invoice::STATUS_VOID);

        if ($visibility !== null) {
            $totalsQuery->where($visibility['column'], $visibility['value']);
        }

        $totals = $totalsQuery
            ->selectRaw('COALESCE(SUM(total_cents), 0) AS billed_cents')
            ->selectRaw('COALESCE(SUM(paid_amount_cents), 0) AS collected_cents')
            ->selectRaw('COALESCE(SUM(balance_due_cents), 0) AS pending_cents')
            ->first();

        $billed = (int) round((float) ($totals->billed_cents ?? 0));
        $collected = (int) round((float) ($totals->collected_cents ?? 0));
        $pending = (int) round((float) ($totals->pending_cents ?? 0));

        return response()->json([
            'data' => [
                'patient_name' => $name,
                'invoice_count' => $invoices->count(),
                'total_billed' => $this->formatCents($billed),
                'total_collected' => $this->formatCents($collected),
                'total_pending' => $this->formatCents($pending),
                'invoices' => $invoices,
            ],
        ]);
    }

    /**
     * @return array{column: string, value: mixed}|null
     */
    private function visibilityScope(User $user, bool $accessHistorical): ?array
    {
        if ($accessHistorical) {
            return null;
        }

        return [
            'column' => 'issued_by',
            'value' => $user->id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function emptySummary(string $name): array
    {
        return [
            'patient_name' => $name,
            'invoice_count' => 0,
            'total_billed' => '0.00',
            'total_collected' => '0.00',
            'total_pending' => '0.00',
            'invoices' => [],
        ];
    }

    private function formatCents(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $absolute = abs($cents);

        return $sign.intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);
    }
}
