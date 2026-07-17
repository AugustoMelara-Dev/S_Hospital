<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use BackedEnum;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;
use LogicException;
use Spatie\Permission\Contracts\Permission;
use Spatie\Permission\Exceptions\PermissionDoesNotExist;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $username
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property bool $active
 * @property Carbon|null $deactivated_at
 * @property bool $must_change_password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class User extends Authenticatable
{
    public const EXACT_ACCESS_MARKER_PERMISSION = 'system.exact_user_permissions';

    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable {
        HasRoles::hasPermissionTo as protected spatieHasPermissionTo;
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'username',
        'password',
        'active',
        'deactivated_at',
        'must_change_password',
        'service_area_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected static function booted(): void
    {
        static::deleting(function (): never {
            throw new LogicException('Los usuarios no se eliminan; deben desactivarse con motivo y auditoria.');
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'active' => 'boolean',
            'deactivated_at' => 'datetime',
            'must_change_password' => 'boolean',
            'service_area_id' => 'integer',
            'password' => 'hashed',
        ];
    }

    /**
     * @return BelongsTo<ServiceArea, $this>
     */
    public function serviceArea(): BelongsTo
    {
        return $this->belongsTo(ServiceArea::class, 'service_area_id');
    }

    /**
     * @param  string|int|Permission|BackedEnum  $permission
     * @param  string|null  $guardName
     */
    public function hasPermissionTo($permission, $guardName = null): bool
    {
        if ($this->usesExactDirectPermissionMap()) {
            $permission = $this->filterPermission($permission, $guardName);

            return $this->hasDirectPermission($permission);
        }

        return $this->spatieHasPermissionTo($permission, $guardName);
    }

    /**
     * @param  string|int|Permission|BackedEnum  $permission
     * @param  string|null  $guardName
     */
    public function checkPermissionTo($permission, $guardName = null): bool
    {
        try {
            return $this->hasPermissionTo($permission, $guardName);
        } catch (PermissionDoesNotExist) {
            return false;
        }
    }

    public function usesExactDirectPermissionMap(): bool
    {
        return $this->loadMissing('permissions')
            ->permissions
            ->contains('name', self::EXACT_ACCESS_MARKER_PERMISSION);
    }
}
