<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $receipt_print_profile_id
 * @property string $scope_type
 * @property int|null $scope_id
 * @property bool $active
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ReceiptProfileAssignment extends Model
{
    public const SCOPE_GLOBAL = 'global';

    public const SCOPE_USER = 'user';

    public const SCOPE_CASH_SESSION = 'cash_session';

    public const SCOPE_CASH_REGISTER = 'cash_register';

    protected $fillable = [
        'receipt_print_profile_id',
        'scope_type',
        'scope_id',
        'active',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'scope_id' => 'integer',
            'active' => 'boolean',
        ];
    }

    /** @return BelongsTo<ReceiptPrintProfile, $this> */
    public function printProfile(): BelongsTo
    {
        return $this->belongsTo(ReceiptPrintProfile::class, 'receipt_print_profile_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
