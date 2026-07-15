<?php

namespace App\Actions\Billing;

use App\Actions\InstitutionalReceipts\ResolveReceiptPrintProfileAction;
use App\Events\InvoiceChanged;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
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

                $dialysisPrescription = $this->resolveDialysisPrescription($payload, $issuer);
                $preparedItems = $this->prepareItems($payload['items']);
                $settings = FiscalSetting::query()->first();
                $taxRate = $settings?->default_tax_rate ?? '15.00';
                $totals = $this->calculateInvoiceTotals->execute($preparedItems, (string) $taxRate, $dialysisPrescription);
                $fiscal = $this->generateFiscalNumber->execute();
                $sequence = $fiscal['sequence'];
                $isZeroTotal = $this->isZeroAmount($totals['total']);

                $sumItems = array_reduce($totals['items'], fn (int $carry, array $item) => $carry + $item['line_total_cents'], 0);
                if ($sumItems !== $totals['total_cents']) {
                    throw new \RuntimeException('Invariante fallido: la suma de las lineas no coincide con el total de la factura.');
                }

                $paperSize = 'half_letter';
                try {
                    $printProfile = app(ResolveReceiptPrintProfileAction::class)->execute($issuer, $cashSession);
                    $paperSize = ReceiptPaperSize::fromProfilePaperKind($printProfile->paper_kind);
                } catch (\Exception $e) {
                    if ($settings?->receipt_paper_size) {
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
                    'hospital_name' => $settings?->hospital_name,
                    'hospital_rtn' => $settings?->rtn,
                    'hospital_address' => $settings?->address,
                    'hospital_phone' => $settings?->phone,
                    'hospital_slogan' => $settings?->slogan,
                    'receipt_template_mode' => $settings?->receipt_template_mode ?? 'institutional',
                    'receipt_paper_size' => ReceiptPaperSize::normalize($paperSize),
                    'receipt_government_line' => $settings?->government_line,
                    'receipt_secretariat_line' => $settings?->secretariat_line,
                    'receipt_location' => $settings?->receipt_location ?? $settings?->address,
                    'receipt_footer_text' => $settings?->receipt_footer_text,
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
                    'cash_session_id' => $cashSession->id,
                    'issued_by' => $issuer->id,
                    'issued_at' => now(),
                ]);

                foreach ($totals['items'] as $item) {
                    $invoice->items()->create($item);
                }

                $this->auditDialysisPrescriptionAppliedIfNeeded($totals['items'], $invoice, $issuer, $request);

                if ($isZeroTotal) {
                    Payment::query()->create([
                        'invoice_id' => $invoice->id,
                        'cash_session_id' => $cashSession->id,
                        'user_id' => $issuer->id,
                        'method' => Payment::METHOD_OTHER,
                        'amount' => '0.00',
                        'amount_cents' => 0,
                        'reference' => 'Receta dialisis: factura sin cobro',
                        'status' => Payment::STATUS_POSTED,
                        'paid_at' => $invoice->issued_at,
                    ]);

                    AuditLog::query()->create([
                        'user_id' => $issuer->id,
                        'action' => 'invoice.zero_amount_registered',
                        'entity_type' => Invoice::class,
                        'entity_id' => $invoice->id,
                        'new_values' => [
                            'invoice_number' => $invoice->invoice_number,
                            'reference' => 'Factura sin cobro por regla autorizada',
                            'balance_due' => $invoice->balance_due,
                        ],
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
                    InvoiceChanged::dispatch($invoice->fresh(), 'created');
                });

                return $invoice->load('items', 'issuer:id,name,username');
            });
        } catch (ValidationException $exception) {
            if ($this->isDialysisPrescriptionDeniedValidation($payload, $issuer, $exception)) {
                $this->auditDialysisPrescriptionDenied($payload, $issuer, $request);
            }

            throw $exception;
        }
    }

    /**
     * Resolves the invoice-level `dialysis_prescription` flag. The flag
     * may ONLY be set by users with the `patients.mark_dialysis_prescription`
     * permission; cashiers cannot toggle it from the POS UI. If a cashier
     * submits `dialysis_prescription: true` in the payload, the value is
     * rejected.
     *
     * @param  array{patient_name: string, items: list<array{service_id: int, quantity: string, notes?: ?string}>, dialysis_prescription?: bool}  $payload
     */
    private function resolveDialysisPrescription(array $payload, User $issuer): bool
    {
        $requested = (bool) ($payload['dialysis_prescription'] ?? false);

        if (! $requested) {
            return false;
        }

        if (! $issuer->can('patients.mark_dialysis_prescription')) {
            throw ValidationException::withMessages([
                'dialysis_prescription' => 'No tiene permiso para marcar pacientes con receta de dialisis.',
            ]);
        }

        return true;
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

    /**
     * @param  list<array{service_id: int, quantity: string, notes?: ?string}>  $items
     * @return list<array{service: Service, quantity: string, notes: ?string}>
     */
    private function prepareItems(array $items): array
    {
        $serviceIds = collect($items)->pluck('service_id')->unique()->values();
        $services = Service::query()
            ->with(['category:id,name,active', 'area:id,name,slug'])
            ->whereIn('id', $serviceIds)
            ->get()
            ->keyBy('id');

        $prepared = [];

        foreach ($items as $index => $item) {
            /** @var Service|null $service */
            $service = $services->get($item['service_id']);
            $field = "items.{$index}.service_id";

            if ($service === null) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado no existe.',
                ]);
            }

            if (! $service->active) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado esta inactivo.',
                ]);
            }

            if (! $service->category?->active) {
                throw ValidationException::withMessages([
                    $field => 'La categoria del servicio seleccionado esta inactiva.',
                ]);
            }

            if (! $service->visible_in_billing) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado no esta visible para facturacion.',
                ]);
            }

            if (! $service->is_billable) {
                throw ValidationException::withMessages([
                    $field => 'El servicio seleccionado no es facturable.',
                ]);
            }

            $prepared[] = [
                'service' => $service,
                'quantity' => $item['quantity'],
                'notes' => $this->normalizeItemNotes($item['notes'] ?? null),
            ];
        }

        return $prepared;
    }

    private function normalizeItemNotes(mixed $notes): ?string
    {
        if (! is_string($notes)) {
            return null;
        }

        $normalized = trim($notes);

        return $normalized === '' ? null : $normalized;
    }

    private function isZeroAmount(string $amount): bool
    {
        return Money::parseCents($amount, 'total') === 0;
    }
}
