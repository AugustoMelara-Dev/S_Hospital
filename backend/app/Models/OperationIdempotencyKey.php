<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OperationIdempotencyKey extends Model
{
    protected $fillable = [
        'key',
        'user_id',
        'operation',
        'resource_type',
        'resource_id',
        'request_hash',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
