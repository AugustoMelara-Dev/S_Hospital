<?php

namespace App\Actions\Billing;

use App\Actions\InstitutionalReceipts\AmountToSpanishWords;
use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Actions\InstitutionalReceipts\ResolveReceiptPrintProfileAction;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceiptSeries;
use App\Models\User;
use App\Support\Money;
use Illuminate\Validation\ValidationException;

class PreviewInvoiceReceiptAction
{
    public function __construct(
        private readonly PreviewInvoiceTotalsAction $previewTotals,
        private readonly ResolveReceiptPrintProfileAction $resolveProfile,
        private readonly InstitutionalReceiptPdfService $pdfService,
        private readonly AmountToSpanishWords $amountToWords,
    ) {}

    /**
     * @param  array{patient_name: string, items: list<array{service_id: int, quantity: string, notes?: ?string}>, dialysis_prescription?: bool}  $payload
     * @return array<string, mixed>
     */
    public function execute(array $payload, User $issuer): array
    {
        $valuation = $this->previewTotals->execute($payload, $issuer);
        $totals = is_array($valuation['totals'] ?? null) ? $valuation['totals'] : [];
        $tax = is_array($valuation['tax'] ?? null) ? $valuation['tax'] : [];
        $valuationItems = array_values(array_filter(
            is_array($valuation['items'] ?? null) ? $valuation['items'] : [],
            fn (mixed $item): bool => is_array($item),
        ));
        $totalCents = $totals['total_cents'] ?? null;

        if (! is_int($totalCents)) {
            throw ValidationException::withMessages([
                'tax_rate' => 'No se puede generar la vista previa del comprobante sin una valoracion monetaria completa.',
            ]);
        }

        $cashSession = CashRegisterSession::query()
            ->where('user_id', $issuer->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->latest('opened_at')
            ->first();
        $profile = $this->resolveProfile->execute($issuer, $cashSession);
        $series = InstitutionalReceiptSeries::query()
            ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
            ->where('active', true)
            ->first();

        $subtotalCents = $this->intValue($totals['subtotal_cents'] ?? null);
        $exemptCents = $this->intValue($totals['exempt_cents'] ?? null);
        $taxCents = $this->intValue($totals['tax_cents'] ?? null);
        $discountCents = $this->intValue($totals['discount_cents'] ?? null);
        $concept = collect($valuationItems)
            ->pluck('service_name')
            ->filter(fn (mixed $name): bool => is_string($name) && trim($name) !== '')
            ->unique()
            ->take(5)
            ->implode(', ');

        $draft = [
            'payer_name' => $payload['patient_name'],
            'concept' => $concept !== '' ? $concept : 'Servicios hospitalarios',
            'amount' => Money::formatCents($totalCents),
            'amount_words' => $this->amountToWords->forCents($totalCents),
            'amount_statement' => $this->amountToWords->forCents($totalCents),
            'amount_total_note' => 'Total previsto de la operación.',
            'watermark' => 'BORRADOR - SIN VALIDEZ',
            'invoice' => [
                'tax_label' => $this->stringValue($tax['label'] ?? null, 'ISV'),
                'tax_rate_snapshot' => $tax['rate'] ?? null,
                'subtotal' => Money::formatCents($subtotalCents),
                'exempt_amount' => Money::formatCents($exemptCents),
                'tax_amount' => Money::formatCents($taxCents),
                'discount_amount' => Money::formatCents($discountCents),
                'total' => Money::formatCents($totalCents),
                'paid_amount' => '0.00',
                'balance_due' => Money::formatCents($totalCents),
            ],
            'items' => collect($valuationItems)->map(fn (array $item): array => [
                ...$item,
                'tax_amount_cents' => $item['tax_cents'],
                'line_total_cents' => $item['line_total_cents'],
            ])->all(),
        ];

        $plan = $this->pdfService->planForDraft($draft, $profile, $series);

        return [
            'draft' => true,
            'watermark' => 'BORRADOR - SIN VALIDEZ',
            'reserved_number' => false,
            'document' => $plan->toArray(),
            'html' => $plan->html(),
            'valuation' => $valuation,
        ];
    }

    private function intValue(mixed $value): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_float($value)) {
            return (int) $value;
        }

        return is_string($value) && is_numeric($value) ? (int) $value : 0;
    }

    private function stringValue(mixed $value, string $fallback): string
    {
        return is_string($value) ? $value : $fallback;
    }
}
