<?php

namespace App\Actions\Receipts;

use App\Models\Invoice;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\Request;

class ReprintReceiptAction
{
    public function __construct(
        private readonly GenerateReceiptDataAction $generateReceiptData,
        private readonly AuditLogger $auditLogger,
    ) {}

    public function execute(Invoice $invoice, User $user, string $width, ?string $reason = null, ?Request $request = null): array
    {
        $receipt = $this->generateReceiptData->execute($invoice, $width);

        $this->auditLogger->log(
            action: 'invoice.reprinted',
            entity: $invoice,
            user: $user,
            request: $request,
            oldValues: null,
            newValues: [
                'invoice_number' => $invoice->invoice_number,
                'width' => $width,
            ],
            reason: $reason,
        );

        return [
            'receipt' => $receipt,
            'audit' => [
                'action' => 'invoice.reprinted',
                'invoice_id' => $invoice->id,
                'width' => $width,
                'reason' => $reason,
            ],
        ];
    }
}
