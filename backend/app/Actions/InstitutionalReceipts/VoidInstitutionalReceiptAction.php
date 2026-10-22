<?php

namespace App\Actions\InstitutionalReceipts;

use App\Actions\Billing\PreservesIssuedTimestamps;
use App\Models\AuditLog;
use App\Models\InstitutionalReceipt;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Collection;

class VoidInstitutionalReceiptAction
{
    // M-W2-RCP-04: anular no debe dejar que MariaDB reescriba
    // `institutional_receipts.issued_at`.
    use PreservesIssuedTimestamps;

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

            // M-W2-RCP-04: capturar issued_at antes de anular (hecho historico de
            // emision); la anulacion agrega el estado y el motivo, no reemite.
            $issuedAt = $receipt->issued_at;

            $receipt->forceFill([
                'status' => InstitutionalReceipt::STATUS_VOID,
                'voided_by' => $user->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ])->save();

            // Restaura el hecho historico reasignandolo de forma explicita.
            $this->restoreTimestamp('institutional_receipts', $receipt->getKey(), 'issued_at', $issuedAt);

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
