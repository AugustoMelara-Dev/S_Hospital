<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\AuditLog;
use App\Models\InstitutionalReceipt;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Collection;

class VoidInstitutionalReceiptAction
{
    /**
     * @return Collection<int, InstitutionalReceipt>
     */
    public function forInvoice(Invoice $invoice, User $user, string $reason): Collection
    {
        $reason = trim($reason);

        /** @var Collection<int, InstitutionalReceipt> $receipts */
        $receipts = InstitutionalReceipt::query()
            ->where('invoice_id', $invoice->id)
            ->where('status', InstitutionalReceipt::STATUS_ISSUED)
            ->lockForUpdate()
            ->get();

        return $receipts->map(function (InstitutionalReceipt $receipt) use ($invoice, $user, $reason): InstitutionalReceipt {
            $oldValues = [
                'status' => $receipt->status,
                'void_reason' => $receipt->void_reason,
                'voided_by' => $receipt->voided_by,
                'voided_at' => $receipt->voided_at,
            ];

            $receipt->forceFill([
                'status' => InstitutionalReceipt::STATUS_VOID,
                'voided_by' => $user->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ])->save();

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'institutional_receipt.voided',
                'entity_type' => InstitutionalReceipt::class,
                'entity_id' => $receipt->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'status' => $receipt->status,
                    'void_reason' => $receipt->void_reason,
                    'voided_by' => $receipt->voided_by,
                    'voided_at' => $receipt->voided_at,
                    'invoice_id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                ],
                'created_at' => now(),
            ]);

            return $receipt->refresh();
        });
    }
}
