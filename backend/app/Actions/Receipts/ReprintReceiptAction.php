<?php

declare(strict_types=1);

namespace App\Actions\Receipts;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\User;

class ReprintReceiptAction
{
    public function __construct(
        private readonly GenerateReceiptDataAction $generateReceiptData,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function execute(Invoice $invoice, User $user, string $width, ?string $reason = null): array
    {
        $receipt = $this->generateReceiptData->execute($invoice, $width);

        AuditLog::query()->create([
            'user_id' => $user->id,
            'action' => 'invoice.reprinted',
            'entity_type' => Invoice::class,
            'entity_id' => $invoice->id,
            'old_values' => null,
            'new_values' => [
                'invoice_number' => $invoice->invoice_number,
                'width' => $width,
                'reason' => $reason,
            ],
            'created_at' => now(),
        ]);

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
