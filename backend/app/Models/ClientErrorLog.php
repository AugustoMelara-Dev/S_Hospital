<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientErrorLog extends Model
{
    protected $fillable = [
        'user_id',
        'event_type',
        'severity',
        'safe_message',
        'technical_code',
        'route',
        'status_code',
        'context_json',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'context_json' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
