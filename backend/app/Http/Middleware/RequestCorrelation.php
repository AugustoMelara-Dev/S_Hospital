<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RequestCorrelation
{
    public static function id(Request $request): string
    {
        $id = $request->attributes->get('request_id');
        if (! is_string($id) || ! Str::isUuid($id)) {
            $id = (string) Str::uuid();
            $request->attributes->set('request_id', $id);
        }

        return $id;
    }

    public function handle(Request $request, Closure $next): Response
    {
        // Never trust a caller-supplied header as a server diagnostic reference.
        $request->attributes->set('request_id', (string) Str::uuid());
        $response = $next($request);
        $response->headers->set('X-Request-ID', self::id($request));

        return $response;
    }
}
