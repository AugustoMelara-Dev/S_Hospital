<?php

namespace App\Actions\Receipts;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReprintReceiptAction
{
    public function __construct(
        private readonly GenerateReceiptDataAction $generateReceiptData,
    ) {}

    public function execute(Invoice $invoice, User $user, string $width, ?string $reason = null): array
    {
        return DB::transaction(function () use ($invoice, $user, $width, $reason) {
            $lockedInvoice = Invoice::query()
                ->whereKey($invoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedInvoice->status === Invoice::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'invoice' => 'No se puede reimprimir una factura anulada.',
                ]);
            }

            $reprintCount = AuditLog::query()
                ->where('entity_type', Invoice::class)
                ->where('entity_id', $lockedInvoice->id)
                ->where('action', 'invoice.reprinted')
                ->count() + 1;

            $copyLabel = sprintf('Reimpresion #%d', $reprintCount);

            $receipt = $this->generateReceiptData->execute($lockedInvoice, $width, $copyLabel);

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'invoice.reprinted',
                'entity_type' => Invoice::class,
                'entity_id' => $lockedInvoice->id,
                'old_values' => null,
                'new_values' => [
                    'invoice_number' => $lockedInvoice->invoice_number,
                    'width' => $width,
                    'reason' => $reason,
                    'reprint_count' => $reprintCount,
                    'copy_label' => $copyLabel,
                ],
                'created_at' => now(),
            ]);

            return [
                'receipt' => $receipt,
                'audit' => [
                    'action' => 'invoice.reprinted',
                    'invoice_id' => $lockedInvoice->id,
                    'width' => $width,
                    'reason' => $reason,
                    'reprint_count' => $reprintCount,
                    'copy_label' => $copyLabel,
                ],
            ];
        });
    }
}
