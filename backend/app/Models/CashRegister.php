<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * M-W2-DB-01 (mandato §7): caja fisica / puesto de atencion.
 *
 * No confundir con la sesion de caja (`CashRegisterSession`): una caja tiene
 * muchas sesiones a lo largo del tiempo, y solo una abierta a la vez (garantizado
 * por el indice unico `(cash_register_id, open_marker)`).
 *
 * @property int $id
 * @property string $code
 * @property string $name
 * @property bool $active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Collection<int, CashRegisterSession> $sessions
 */
class CashRegister extends Model
{
    protected $fillable = [
        'code',
        'name',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    /** @return HasMany<CashRegisterSession, $this> */
    public function sessions(): HasMany
    {
        return $this->hasMany(CashRegisterSession::class, 'cash_register_id');
    }
}
