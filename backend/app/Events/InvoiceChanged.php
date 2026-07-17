<?php

namespace App\Events;

use App\Models\Invoice;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
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
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('invoices')];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->invoice->id,
            'status' => $this->invoice->status,
            'change' => $this->change,
            'at' => $this->invoice->updated_at?->toIso8601String(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'invoice.changed';
    }
}
