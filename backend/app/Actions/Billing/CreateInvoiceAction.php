<?php

namespace App\Actions\Billing;

use App\Actions\InstitutionalReceipts\ResolveReceiptPrintProfileAction;
use App\Events\InvoiceChanged;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use App\Support\Money;
use App\Support\ReceiptPaperSize;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateInvoiceAction
{
    public function __construct(
        private readonly GenerateFiscalNumberAction $generateFiscalNumber,
        private readonly CalculateInvoiceTotalsAction $calculateInvoiceTotals,
        private readonly PrepareInvoiceItemsAction $prepareInvoiceItems,
        private readonly ResolveInvoiceDialysisPrescriptionAction $resolveDialysisPrescription,
        private readonly ResolveInvoiceTaxRateAction $resolveInvoiceTaxRate,
    ) {}

    /**
     * @param  array{patient_name: string, items: list<array{service_id: int, quantity: string, notes?: ?string}>, dialysis_prescription?: bool}  $payload
     */
    public function execute(array $payload, User $issuer, ?Request $request = null): Invoice
    {
        try {
            return DB::transaction(function () use ($payload, $issuer, $request): Invoice {
                $cashSession = CashRegisterSession::query()
                    ->where('user_id', $issuer->id)
                    ->where('status', CashRegisterSession::STATUS_OPEN)
                    ->lockForUpdate()
                    ->first();

                if ($cashSession === null) {
                    throw ValidationException::withMessages([
                        'cash_session_id' => 'Abra caja antes de emitir y cobrar una factura.',
                    ]);
                }

                $dialysisPrescription = $this->resolveDialysisPrescription->execute(
                    (bool) ($payload['dialysis_prescription'] ?? false),
                    $issuer,
                );
                $preparedItems = $this->prepareInvoiceItems->execute($payload['items']);
                $settings = FiscalSetting::query()->firstOrNew();
                $taxRateResolution = $this->resolveInvoiceTaxRate->execute($settings);
                $taxRate = $taxRateResolution['rate'];

                if ($taxRate === null) {
                    throw ValidationException::withMessages([
                        'tax_rate' => 'La tasa de impuesto configurada no tiene un formato valido.',
                    ]);
                }

                $totals = $this->calculateInvoiceTotals->execute($preparedItems, $taxRate, $dialysisPrescription);
                $fiscal = $this->generateFiscalNumber->execute();
                $sequence = $fiscal['sequence'];
                $isZeroTotal = $this->isZeroAmount($totals['total']);
                $hasRuleFreeLine = collect($totals['items'])
                    ->contains(fn (array $item): bool => ($item['special_rule_applied'] ?? false) === true);
                $zeroReason = $isZeroTotal
                    ? ($hasRuleFreeLine
                        ? PreviewInvoiceTotalsAction::ZERO_REASON_ALL_LINES_FREE_BY_RULE
                        : PreviewInvoiceTotalsAction::ZERO_REASON_CONFIGURED_ZERO_PRICE)
                    : null;
                $settlement = $isZeroTotal
                    ? ($hasRuleFreeLine
                        ? Invoice::SETTLEMENT_FREE_BY_RULE
                        : Invoice::SETTLEMENT_ZERO_PRICE)
                    : Invoice::SETTLEMENT_PENDING;

                $sumItems = array_reduce($totals['items'], function (int $carry, array $item): int {
                    $lineTotalCents = $item['line_total_cents'] ?? null;

                    if (! is_int($lineTotalCents)) {
                        throw new \RuntimeException('Invariante fallido: una linea no tiene total entero en centavos.');
                    }

                    return $carry + $lineTotalCents;
                }, 0);
                if ($sumItems !== $totals['total_cents']) {
                    throw new \RuntimeException('Invariante fallido: la suma de las lineas no coincide con el total de la factura.');
                }

                $paperSize = 'half_letter';
                try {
                    $printProfile = app(ResolveReceiptPrintProfileAction::class)->execute($issuer, $cashSession);
                    $paperSize = ReceiptPaperSize::fromProfilePaperKind($printProfile->paper_kind);
                } catch (\Exception $e) {
                    if ($settings->receipt_paper_size) {
                        $paperSize = $settings->receipt_paper_size;
                    }
                }

                $invoice = Invoice::query()->create([
                    'invoice_number' => $fiscal['invoice_number'],
                    'fiscal_sequence_id' => $sequence->id,
                    'fiscal_cai' => $sequence->cai,
                    'fiscal_range_from' => $sequence->prefix.'-'.str_pad((string) $sequence->min_number, 8, '0', STR_PAD_LEFT),
                    'fiscal_range_to' => $sequence->prefix.'-'.str_pad((string) $sequence->max_number, 8, '0', STR_PAD_LEFT),
                    'fiscal_valid_until' => $sequence->valid_until,
                    'fiscal_prefix' => $sequence->prefix,
                    'hospital_name' => $settings->hospital_name,
                    'hospital_rtn' => $settings->rtn,
                    'hospital_address' => $settings->address,
                    'hospital_phone' => $settings->phone,
                    'hospital_slogan' => $settings->slogan,
                    'receipt_template_mode' => $settings->receipt_template_mode ?? 'institutional',
                    'receipt_paper_size' => ReceiptPaperSize::normalize($paperSize),
                    'receipt_government_line' => $settings->government_line,
                    'receipt_secretariat_line' => $settings->secretariat_line,
                    'receipt_location' => $settings->receipt_location ?? $settings->address,
                    'receipt_footer_text' => $settings->receipt_footer_text,
                    'tax_label' => 'ISV',
                    'tax_rate_snapshot' => $taxRate,
                    'patient_name' => trim($payload['patient_name']),
                    'subtotal' => $totals['subtotal'],
                    'subtotal_cents' => $totals['subtotal_cents'],
                    'tax_amount' => $totals['tax_amount'],
                    'tax_amount_cents' => $totals['tax_amount_cents'],
                    'discount_amount' => $totals['discount_amount'],
                    'discount_amount_cents' => $totals['discount_amount_cents'],
                    'total' => $totals['total'],
                    'total_cents' => $totals['total_cents'],
                    'paid_amount' => $isZeroTotal ? $totals['total'] : '0.00',
                    'paid_amount_cents' => $isZeroTotal ? $totals['total_cents'] : 0,
                    'balance_due' => $isZeroTotal ? '0.00' : $totals['total'],
                    'balance_due_cents' => $isZeroTotal ? 0 : $totals['total_cents'],
                    'status' => $isZeroTotal ? Invoice::STATUS_PAID : Invoice::STATUS_ISSUED,
                    'settlement' => $settlement,
                    'cash_session_id' => $cashSession->id,
                    'issued_by' => $issuer->id,
                    'issued_at' => now(),
                ]);

                foreach ($totals['items'] as $item) {
                    // MANDATO_DEV §8/§14: la linea calculada trae el precio de
                    // catalogo (`unit_price_registered_cents`) y el ajuste por
                    // regla (`rule_adjustment_cents`) ademas del precio efectivo.
                    // Se persisten los tres en centavos; el ajuste es informativo
                    // y ya esta incluido en `unit_price_cents` (0 si es gratuita).
                    $item['unit_price_registered_cents'] = $item['unit_price_registered_cents']
                        ?? $item['unit_price_cents'];
                    $item['rule_adjustment_cents'] = $item['rule_adjustment_cents'] ?? 0;

                    $invoice->items()->create($item);
                }

                $this->auditDialysisPrescriptionAppliedIfNeeded($totals['items'], $invoice, $issuer, $request);

                if ($isZeroTotal) {
                    // MANDATO_DEV §8: una operacion totalmente gratuita NO crea
                    // un cobro ficticio (Payment en `other`) ni un movimiento de
                    // caja. La emision sin cobro queda representada por
                    // `settlement` y su auditoria trazable.
                    AuditLog::query()->create([
                        'user_id' => $issuer->id,
                        'action' => 'invoice.issued_without_charge',
                        'result' => 'success',
                        'entity_type' => Invoice::class,
                        'entity_id' => $invoice->id,
                        'new_values' => [
                            'invoice_number' => $invoice->invoice_number,
                            'patient_name' => $invoice->patient_name,
                            'cash_session_id' => $cashSession->id,
                            'settlement' => $invoice->settlement,
                            'zero_reason' => $zeroReason,
                            'total' => $invoice->total,
                        ],
                        'reason' => $zeroReason === PreviewInvoiceTotalsAction::ZERO_REASON_ALL_LINES_FREE_BY_RULE
                            ? 'Factura sin cobro por regla EPO por linea autorizada.'
                            : 'Factura sin cobro por precio cero configurado.',
                    ]);
                }

                AuditLog::query()->create([
                    'user_id' => $issuer->id,
                    'action' => 'invoice.issued',
                    'result' => 'success',
                    'entity_type' => Invoice::class,
                    'entity_id' => $invoice->id,
                    'old_values' => null,
                    'new_values' => [
                        'invoice_number' => $invoice->invoice_number,
                        'patient_name' => $invoice->patient_name,
                        'total' => $invoice->total,
                        'status' => $invoice->status,
                        'cash_session_id' => $cashSession->id,
                    ],
                    'ip_address' => $request?->ip(),
                    'ip' => $request?->ip(),
                    'user_agent' => $request?->userAgent(),
                    'url' => $request?->fullUrl(),
                    'http_method' => $request?->method(),
                ]);

                // Broadcast after-commit so the websocket event only fires
                // if the DB transaction actually committed. Listeners
                // (other cashier PCs) get a fresh invoice they can refetch.
                DB::afterCommit(function () use ($invoice) {
                    InvoiceChanged::dispatch($invoice->refresh(), 'created');
                });

                return $invoice->load('items', 'issuer:id,name,username', 'payments');
            });
        } catch (ValidationException $exception) {
            if ($this->isDialysisPrescriptionDeniedValidation($payload, $issuer, $exception)) {
                $this->auditDialysisPrescriptionDenied($payload, $issuer, $request);
            }

            throw $exception;
        }
    }

    /**
     * @param  array{patient_name: string, items: list<array{service_id: int, quantity: string, notes?: ?string}>, dialysis_prescription?: bool}  $payload
     */
    private function isDialysisPrescriptionDeniedValidation(array $payload, User $issuer, ValidationException $exception): bool
    {
        return (bool) ($payload['dialysis_prescription'] ?? false)
            && ! $issuer->can('patients.mark_dialysis_prescription')
            && array_key_exists('dialysis_prescription', $exception->errors());
    }

    /**
     * @param  array{patient_name: string, items: list<array{service_id: int, quantity: string, notes?: ?string}>, dialysis_prescription?: bool}  $payload
     */
    private function auditDialysisPrescriptionDenied(array $payload, User $issuer, ?Request $request = null): void
    {
        AuditLog::query()->create([
            'user_id' => $issuer->id,
            'action' => 'invoice.dialysis_prescription_denied',
            'result' => 'failed',
            'entity_type' => User::class,
            'entity_id' => $issuer->id,
            'old_values' => null,
            'new_values' => [
                'requested' => true,
                'patient_name' => trim($payload['patient_name']),
                'item_count' => count($payload['items']),
                'reason' => 'missing_permission',
            ],
            'reason' => 'No tiene permiso para marcar pacientes con receta de dialisis.',
            'ip_address' => $request?->ip(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'url' => $request?->fullUrl(),
            'http_method' => $request?->method(),
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function auditDialysisPrescriptionAppliedIfNeeded(array $items, Invoice $invoice, User $issuer, ?Request $request = null): void
    {
        $appliedItems = collect($items)
            ->filter(fn (array $item): bool => ($item['special_rule_code'] ?? null) === Service::ERYTHROPOIETIN_RULE
                && ($item['special_rule_applied'] ?? false) === true)
            ->map(fn (array $item): array => [
                'service_id' => $item['service_id'] ?? null,
                'service_name' => $item['service_name'] ?? null,
                'quantity' => $item['quantity'] ?? null,
                'unit_price' => $item['unit_price'] ?? null,
                'line_total' => $item['line_total'] ?? null,
                'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
            ])
            ->values()
            ->all();

        if ($appliedItems === []) {
            return;
        }

        AuditLog::query()->create([
            'user_id' => $issuer->id,
            'action' => 'invoice.dialysis_prescription_applied',
            'result' => 'success',
            'entity_type' => Invoice::class,
            'entity_id' => $invoice->id,
            'old_values' => null,
            'new_values' => [
                'invoice_number' => $invoice->invoice_number,
                'patient_name' => $invoice->patient_name,
                'cash_session_id' => $invoice->cash_session_id,
                'applied_items' => $appliedItems,
            ],
            'ip_address' => $request?->ip(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'url' => $request?->fullUrl(),
            'http_method' => $request?->method(),
        ]);
    }

    private function isZeroAmount(string $amount): bool
    {
        return Money::parseCents($amount, 'total') === 0;
    }
}
