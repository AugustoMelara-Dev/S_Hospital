<?php

namespace App\Events;

use App\Models\Payment;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaymentChanged implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly Payment $payment,
        public readonly string $change, // 'registered' | 'voided'
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('payments'),
            new PrivateChannel('invoices'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->payment->id,
            'invoice_id' => $this->payment->invoice_id,
            'status' => $this->payment->status,
            'change' => $this->change,
            'at' => optional($this->payment->getAttribute('updated_at'))?->toIso8601String(),
        ];
    }

    public function broadcastAs(): string
    {
        return 'payment.changed';
    }
}
