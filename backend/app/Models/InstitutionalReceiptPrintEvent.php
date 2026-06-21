<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $institutional_receipt_id
 * @property string $event_type
 * @property string|null $copy_label
 * @property array<string, mixed>|null $profile_snapshot
 * @property string|null $reason
 * @property int|null $user_id
 * @property Carbon|null $created_at
 * @property-read InstitutionalReceipt|null $receipt
 * @property-read User|null $user
 */
class InstitutionalReceiptPrintEvent extends Model
{
    public const UPDATED_AT = null;

    public const TYPE_ISSUED_PRINT = 'issued_print';

    public const TYPE_REPRINT = 'reprint';

    public const TYPE_TEST_PRINT = 'test_print';

    public const TYPE_PDF_GENERATED = 'pdf_generated';

    protected $fillable = [
        'institutional_receipt_id',
        'event_type',
        'copy_label',
        'profile_snapshot',
        'reason',
        'user_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'profile_snapshot' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(InstitutionalReceipt::class, 'institutional_receipt_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
