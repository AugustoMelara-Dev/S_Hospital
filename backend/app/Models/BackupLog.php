<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $filename
 * @property string|null $path
 * @property string $disk
 * @property int|null $size_bytes
 * @property string|null $checksum_sha256
 * @property string $status
 * @property string $type
 * @property string $format
 * @property string|null $compression
 * @property bool $encrypted
 * @property string|null $encryption_key_id
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $completed_at
 * @property string|null $error_message
 * @property-read User|null $creator
 */
class BackupLog extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SUCCESS = 'success';

    public const STATUS_FAILED = 'failed';

    public const TYPE_MANUAL = 'manual';

    public const TYPE_SCHEDULED = 'scheduled';

    protected $fillable = [
        'filename',
        'path',
        'disk',
        'size_bytes',
        'checksum_sha256',
        'status',
        'type',
        'format',
        'compression',
        'encrypted',
        'encryption_key_id',
        'created_by',
        'completed_at',
        'error_message',
    ];

    protected $hidden = [
        'path',
        'disk',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'encrypted' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
