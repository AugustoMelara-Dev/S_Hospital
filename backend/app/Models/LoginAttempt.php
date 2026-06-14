<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoginAttempt extends Model
{
    protected $fillable = [
        'login',
        'ip',
        'success',
        'user_agent',
        'attempted_at',
    ];

    protected function casts(): array
    {
        return [
            'success' => 'boolean',
            'attempted_at' => 'datetime',
        ];
    }

    /**
     * Count failed attempts for a given login identifier inside a
     * rolling window starting at $since.
     */
    public static function failedCountFor(string $login, \DateTimeInterface $since): int
    {
        return static::query()
            ->where('login', $login)
            ->where('success', false)
            ->where('attempted_at', '>=', $since)
            ->count();
    }

    /**
     * Count failed attempts for a given IP address inside a rolling
     * window. Used as a backup defence when the attacker rotates
     * usernames.
     */
    public static function failedCountForIp(string $ip, \DateTimeInterface $since): int
    {
        return static::query()
            ->where('ip', $ip)
            ->where('success', false)
            ->where('attempted_at', '>=', $since)
            ->count();
    }

    public static function failedCountForLoginAndIp(string $login, string $ip, \DateTimeInterface $since): int
    {
        return static::query()
            ->where('login', $login)
            ->where('ip', $ip)
            ->where('success', false)
            ->where('attempted_at', '>=', $since)
            ->count();
    }
}
