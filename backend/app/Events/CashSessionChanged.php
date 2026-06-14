<?php

namespace App\Events;

use App\Models\CashRegisterSession;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CashSessionChanged implements ShouldBroadcast
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly CashRegisterSession $session,
        public readonly string $change, // 'opened' | 'closed'
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('cash')];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->session->id,
            'status' => $this->session->status,
            'change' => $this->change,
        ];
    }

    public function broadcastAs(): string
    {
        return 'cash-session.changed';
    }
}
