<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $route_signature
 * @property string $idempotency_key
 * @property string $request_fingerprint
 * @property int|null $response_status
 * @property string|null $response_body
 * @property Carbon|null $completed_at
 */
class IdempotencyKey extends Model
{
    protected $fillable = [
        'user_id',
        'route_signature',
        'idempotency_key',
        'request_fingerprint',
        'response_status',
        'response_body',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'response_status' => 'integer',
            'completed_at' => 'datetime',
        ];
    }
}
