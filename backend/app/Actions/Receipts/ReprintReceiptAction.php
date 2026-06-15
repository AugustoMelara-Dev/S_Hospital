<?php

namespace App\Actions\Receipts;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReprintReceiptAction
{
    public function __construct(
        private readonly GenerateReceiptDataAction $generateReceiptData,
        private readonly AuditLogger $auditLogger,
    ) {}

    public function execute(Invoice $invoice, User $user, string $width, ?string $reason = null, ?Request $request = null): array
    {
        return DB::transaction(function () use ($invoice, $user, $width, $reason, $request) {
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

            $this->auditLogger->log(
                action: 'invoice.reprinted',
                entity: $lockedInvoice,
                user: $user,
                request: $request,
                newValues: [
                    'invoice_number' => $lockedInvoice->invoice_number,
                    'width' => $width,
                    'reason' => $reason,
                    'reprint_count' => $reprintCount,
                    'copy_label' => $copyLabel,
                ],
                reason: $reason,
            );

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
