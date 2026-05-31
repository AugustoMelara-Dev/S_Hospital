<?php

namespace App\Actions\Billing;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateInvoiceAction
{
    public function __construct(
        private readonly GenerateFiscalNumberAction $generateFiscalNumber,
        private readonly CalculateInvoiceTotalsAction $calculateInvoiceTotals,
    ) {}

    /**
     * @param  array{patient_name: string, items: list<array{service_id: int, quantity: string, dialysis_prescription?: bool, notes?: ?string}>}  $payload
     */
    public function execute(array $payload, User $issuer): Invoice
    {
        return DB::transaction(function () use ($payload, $issuer): Invoice {
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

            $preparedItems = $this->prepareItems($payload['items']);
            $settings = FiscalSetting::query()->first();
            $taxRate = $settings?->default_tax_rate ?? '15.00';
            $totals = $this->calculateInvoiceTotals->execute($preparedItems, (string) $taxRate);
            $fiscal = $this->generateFiscalNumber->execute();
            $sequence = $fiscal['sequence'];
            $isZeroTotal = $this->isZeroAmount($totals['total']);

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
                'receipt_paper_size' => $settings?->receipt_paper_size ?? 'half_letter',
                'receipt_government_line' => $settings?->government_line ?? 'Gobierno de Honduras',
                'receipt_secretariat_line' => $settings?->secretariat_line ?? 'Secretaria de Salud Publica',
                'receipt_location' => $settings?->receipt_location ?? $settings?->address,
                'receipt_footer_text' => $settings?->receipt_footer_text,
                'tax_label' => 'ISV',
                'tax_rate_snapshot' => $taxRate,
                'patient_name' => trim($payload['patient_name']),
                'subtotal' => $totals['subtotal'],
                'tax_amount' => $totals['tax_amount'],
                'discount_amount' => $totals['discount_amount'],
                'total' => $totals['total'],
                'paid_amount' => $isZeroTotal ? $totals['total'] : '0.00',
                'balance_due' => $isZeroTotal ? '0.00' : $totals['total'],
                'status' => $isZeroTotal ? Invoice::STATUS_PAID : Invoice::STATUS_ISSUED,
                'cash_session_id' => $cashSession->id,
                'issued_by' => $issuer->id,
                'issued_at' => now(),
            ]);

            foreach ($totals['items'] as $item) {
                $invoice->items()->create($item);
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
            ]);

            return $invoice->load('items', 'issuer:id,name,username');
        });
    }

    /**
     * @param  list<array{service_id: int, quantity: string, dialysis_prescription?: bool, notes?: ?string}>  $items
     * @return list<array{service: Service, quantity: string, dialysis_prescription: bool, notes: ?string}>
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
                'dialysis_prescription' => (bool) ($item['dialysis_prescription'] ?? false),
                'notes' => $item['notes'] ?? null,
            ];
        }

        return $prepared;
    }

    private function isZeroAmount(string $amount): bool
    {
        return (float) $amount === 0.0;
    }
}
