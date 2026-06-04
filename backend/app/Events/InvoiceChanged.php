<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Invoice;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcasts whenever an invoice is issued, voided, or reversed.
 * Listeners (frontend) invalidate the invoices query and show a toast.
 */
class InvoiceChanged implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly Invoice $invoice,
        public readonly string $change, // 'created' | 'voided' | 'reversed'
        public readonly ?int $actorId = null,
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel('invoices')];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->invoice->id,
            'invoice_number' => $this->invoice->invoice_number,
            'patient_name' => $this->invoice->patient_name,
            'status' => $this->invoice->status,
            'total' => (string) $this->invoice->total,
            'paid_amount' => (string) $this->invoice->paid_amount,
            'balance_due' => (string) $this->invoice->balance_due,
            'change' => $this->change,
            'at' => optional($this->invoice->getAttribute('updated_at'))?->toIso8601String(),
            'actor_id' => $this->actorId,
        ];
    }

    public function broadcastAs(): string
    {
        return 'invoice.changed';
    }
}
