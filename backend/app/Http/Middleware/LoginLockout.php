<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\LoginAttempt;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LoginLockout
{
    private const MAX_FAILED_ATTEMPTS = 5;

    private const MAX_FAILED_ATTEMPTS_PER_IP = 20;

    private const LOCKOUT_MINUTES = 15;

    public function handle(Request $request, Closure $next): Response
    {
        $login = trim((string) $request->input('login', ''));
        $ip = (string) $request->ip();

        if ($login === '') {
            return $next($request);
        }

        $since = now()->subMinutes(self::LOCKOUT_MINUTES);

        $failedByLogin = LoginAttempt::failedCountFor($login, $since);
        $failedByIp = $ip !== '' ? LoginAttempt::failedCountForIp($ip, $since) : 0;

        if ($failedByLogin >= self::MAX_FAILED_ATTEMPTS) {
            return $this->locked($login, $since, 'login');
        }

        if ($failedByIp >= self::MAX_FAILED_ATTEMPTS_PER_IP) {
            return $this->locked($ip, $since, 'login_ip');
        }

        return $next($request);
    }

    private function locked(string $subject, \DateTimeInterface $since, string $reason): Response
    {
        return response()->json([
            'message' => 'Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario.',
            'lockout_minutes' => self::LOCKOUT_MINUTES,
            'window_start' => $since->format(DATE_ATOM),
            'lockout_reason' => $reason,
        ], 423);
    }
}
