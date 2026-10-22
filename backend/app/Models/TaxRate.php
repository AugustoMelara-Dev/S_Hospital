<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Configurable tax rate (H-15). Each product chooses a rate; `null` on the
 * service means exempt. The invoice item keeps its own `tax_rate` snapshot so
 * historical documents never change when a rate is edited.
 *
 * @property int $id
 * @property string $name
 * @property string $percentage
 * @property bool $active
 * @property bool $is_default
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $creator
 * @property-read User|null $updater
 */
class TaxRate extends Model
{
    protected $fillable = [
        'name',
        'percentage',
        'active',
        'is_default',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'percentage' => 'decimal:2',
            'active' => 'boolean',
            'is_default' => 'boolean',
        ];
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

    /** @return HasMany<Service, $this> */
    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }
}
