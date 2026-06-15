<?php

namespace App\Actions\Billing;

use App\Events\InvoiceChanged;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\OperationIdempotencyKey;
use App\Models\Service;
use App\Models\User;
use App\Support\Money;
use App\Support\ReceiptPaperSize;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateInvoiceAction
{
    public function __construct(
        private readonly GenerateFiscalNumberAction $generateFiscalNumber,
        private readonly CalculateInvoiceTotalsAction $calculateInvoiceTotals,
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{patient_name: string, items: list<array{service_id: int, quantity: string, notes?: ?string}>, dialysis_prescription?: bool}  $payload
     */
    public function execute(array $payload, User $issuer, ?Request $request = null): Invoice
    {
        return DB::transaction(function () use ($payload, $issuer, $request): Invoice {
            $idempotencyKey = $this->idempotencyKey($request);
            $requestHash = $this->requestHash($payload);

            if ($idempotencyKey !== null) {
                $existing = $this->existingInvoiceForKey($idempotencyKey, $requestHash, $issuer->id);
                if ($existing !== null) {
                    return $existing;
                }
            }

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
                'hospital_slogan' => $settings?->slogan,
                'receipt_template_mode' => $settings?->receipt_template_mode ?? 'institutional',
                'receipt_paper_size' => ReceiptPaperSize::normalize($settings?->receipt_paper_size),
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

            if ($isZeroTotal) {
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
            );

            if ($idempotencyKey !== null) {
                OperationIdempotencyKey::query()->create([
                    'key' => $idempotencyKey,
                    'user_id' => $issuer->id,
                    'operation' => 'invoice.create',
                    'resource_type' => Invoice::class,
                    'resource_id' => $invoice->id,
                    'request_hash' => $requestHash,
                ]);
            }

            // Broadcast after-commit so the websocket event only fires
            // if the DB transaction actually committed. Listeners
            // (other cashier PCs) get a fresh invoice they can refetch.
            DB::afterCommit(function () use ($invoice) {
                InvoiceChanged::dispatch($invoice->fresh(), 'created');
            });

            return $invoice->load('items', 'issuer:id,name,username');
        });
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
     * @param  list<array{service_id: int, quantity: string, notes?: ?string}>  $items
     * @return list<array{service: Service, quantity: string, notes: ?string}>
     */
    private function prepareItems(array $items): array
    {
        $serviceIds = collect($items)->pluck('service_id')->unique()->values();
        $services = Service::query()
            ->with(['category:id,name', 'area:id,name'])
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
                'notes' => $item['notes'] ?? null,
            ];
        }

        return $prepared;
    }

    private function isZeroAmount(string $amount): bool
    {
        return Money::parseCents($amount, 'total') === 0;
    }

    private function idempotencyKey(?Request $request): ?string
    {
        $key = trim((string) $request?->header('Idempotency-Key', ''));

        return $key === '' ? null : mb_substr($key, 0, 120);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function requestHash(array $payload): string
    {
        ksort($payload);

        return hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR));
    }

    private function existingInvoiceForKey(string $key, string $requestHash, int $userId): ?Invoice
    {
        $record = OperationIdempotencyKey::query()
            ->where('operation', 'invoice.create')
            ->where('key', $key)
            ->lockForUpdate()
            ->first();

        if ($record === null) {
            return null;
        }

        abort_if(
            $record->request_hash !== $requestHash || $record->user_id !== $userId,
            409,
            'La accion ya fue enviada con datos diferentes. Actualice la pantalla antes de continuar.',
        );

        return Invoice::query()
            ->with('items', 'issuer:id,name,username')
            ->find($record->resource_id);
    }
}
