<?php

namespace App\Models;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;

/**
 * @property int $id
 * @property int $user_id
 * @property string $route_signature
 * @property string $idempotency_key
 * @property string $request_fingerprint
 * @property int|null $response_status
 * @property string|null $response_body ciphertext (Crypt::encryptString)
 * @property string|null $response_body_plain decrypted payload (accessor)
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

    /**
     * Decrypts the persisted response body on read. The DB column stores
     * `Crypt::encryptString()` output, so a backup or direct SQL dump does
     * NOT contain patient names, totals or invoice numbers in plain text.
     *
     * Writes through this attribute also encrypt: assigning a string to
     * `response_body_plain` stores the ciphertext in the underlying column.
     */
    protected function responseBodyPlain(): Attribute
    {
        return Attribute::make(
            get: function (): ?string {
                $value = $this->attributes['response_body'] ?? null;
                if ($value === null || $value === '') {
                    return null;
                }

                try {
                    return Crypt::decryptString($value);
                } catch (DecryptException) {
                    // Legacy rows written before encryption was added (or
                    // accidentally unencrypted rows) are surfaced as the
                    // raw value so the cashier retry is not silently lost.
                    // The middleware rejects non-2xx replays, so leaking
                    // a single legacy plaintext row is acceptable; a
                    // future migration can scrub them.
                    return $value;
                }
            },
            set: function (?string $value): array {
                if ($value === null || $value === '') {
                    return ['response_body' => null];
                }

                return ['response_body' => Crypt::encryptString($value)];
            }
        );
    }
}
