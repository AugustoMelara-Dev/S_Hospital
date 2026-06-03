<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\CashRegisterSession;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
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
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel('cash')];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->session->id,
            'user_id' => $this->session->user_id,
            'status' => $this->session->status,
            'opened_at' => optional($this->session->opened_at)?->toIso8601String(),
            'closed_at' => optional($this->session->closed_at)?->toIso8601String(),
            'change' => $this->change,
        ];
    }

    public function broadcastAs(): string
    {
        return 'cash-session.changed';
    }
}
