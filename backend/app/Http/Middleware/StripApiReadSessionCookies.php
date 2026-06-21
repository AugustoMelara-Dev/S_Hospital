<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StripApiReadSessionCookies
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $isSessionEndpoint = $request->is('api/auth/login')
            || $request->is('api/auth/logout')
            || $request->is('api/auth/change-password')
            || $request->is('sanctum/csrf-cookie');

        if (($request->is('api/*') && ! $isSessionEndpoint) || $request->is('broadcasting/auth')) {
            $response->headers->remove('Set-Cookie');
        }

        return $response;
    }
}
