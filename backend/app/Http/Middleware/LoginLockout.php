<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\LoginAttempt;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Block a login attempt when the identifier or the IP has exceeded the
 * configured failure threshold inside a rolling window. The frontend
 * treats 423 Locked with the same safe message it already knows, so
 * this is a pure backend hardening with zero client changes.
 */
class LoginLockout
{
    private const MAX_FAILED_ATTEMPTS = 5;

    private const LOCKOUT_MINUTES = 15;

    public function handle(Request $request, Closure $next): Response
    {
        $login = (string) $request->input('login', '');

        if ($login === '') {
            return $next($request);
        }

        $since = now()->subMinutes(self::LOCKOUT_MINUTES);

        if (LoginAttempt::failedCountFor($login, $since) >= self::MAX_FAILED_ATTEMPTS) {
            return $this->locked($login, $since);
        }

        $ip = (string) $request->ip();

        if ($ip !== '' && LoginAttempt::failedCountForIp($ip, $since) >= self::MAX_FAILED_ATTEMPTS * 2) {
            return $this->locked($ip, $since);
        }

        return $next($request);
    }

    private function locked(string $subject, \DateTimeInterface $since): Response
    {
        return response()->json([
            'message' => 'Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario.',
            'lockout_minutes' => self::LOCKOUT_MINUTES,
            'window_start' => $since->format(DATE_ATOM),
        ], 423);
    }
}
