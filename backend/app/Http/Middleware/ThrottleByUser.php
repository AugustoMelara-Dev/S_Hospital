<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Per-user rate limit, keyed on the authenticated user id when
 * present and on the request IP otherwise. Laravel's built-in
 * `throttle:` middleware keys on the IP, which means one aggressive
 * cashier can block all other cashiers on the same LAN IP. This
 * middleware gives each user their own bucket.
 *
 * Usage: `Route::middleware(['auth:web', ThrottleByUser::class.':60,1'])`
 */
class ThrottleByUser
{
    public function __construct(private readonly RateLimiter $limiter) {}

    public function handle(Request $request, Closure $next, int $maxAttempts = 60, int $decayMinutes = 1): Response
    {
        $key = $this->resolveKey($request);
        $bucket = $this->bucketFor($key, $maxAttempts, $decayMinutes);

        if ($this->limiter->tooManyAttempts($bucket, $maxAttempts)) {
            $retryAfter = $this->limiter->availableIn($bucket);

            return response()->json([
                'message' => 'Demasiadas solicitudes locales para su usuario. Por favor espere antes de repetir.',
                'retry_after' => $retryAfter,
            ], 429, $this->headers($maxAttempts, 0, $retryAfter));
        }

        $this->limiter->hit($bucket, $decayMinutes * 60);

        $response = $next($request);

        $remaining = max(0, $maxAttempts - $this->limiter->attempts($bucket));

        foreach ($this->headers($maxAttempts, $remaining, $this->limiter->availableIn($bucket)) as $name => $value) {
            $response->headers->set($name, (string) $value);
        }

        return $response;
    }

    private function resolveKey(Request $request): string
    {
        $user = $request->user();

        if ($user !== null) {
            $id = $user->getAuthIdentifier();

            if ($id !== null && $id !== '') {
                return 'u:'.(is_scalar($id) ? (string) $id : 'unknown');
            }
        }

        return 'ip:'.(string) $request->ip();
    }

    private function bucketFor(string $key, int $maxAttempts, int $decayMinutes): string
    {
        return 'throttle_by_user:'.$key.':'.$maxAttempts.':'.$decayMinutes;
    }

    /**
     * @return array<string, int>
     */
    private function headers(int $limit, int $remaining, int $retryAfter): array
    {
        return [
            'X-RateLimit-Limit' => $limit,
            'X-RateLimit-Remaining' => $remaining,
            'Retry-After' => $retryAfter,
        ];
    }
}
