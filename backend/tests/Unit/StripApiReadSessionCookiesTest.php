<?php

namespace Tests\Unit;

use App\Http\Middleware\StripApiReadSessionCookies;
use Illuminate\Http\Request;
use Tests\TestCase;

class StripApiReadSessionCookiesTest extends TestCase
{
    public function test_api_auth_errors_do_not_overwrite_browser_session_cookie(): void
    {
        $middleware = new StripApiReadSessionCookies;
        $request = Request::create('/api/invoices/1/payments', 'POST');

        $response = $middleware->handle($request, function () {
            return response('CSRF token mismatch.', 419)
                ->withCookie(cookie('laravel-session', 'new-broken-session'));
        });

        $this->assertSame(419, $response->getStatusCode());
        $this->assertFalse($response->headers->has('Set-Cookie'));
    }

    public function test_api_successful_business_mutations_do_not_rotate_session_cookie(): void
    {
        $middleware = new StripApiReadSessionCookies;
        $request = Request::create('/api/invoices', 'POST');

        $response = $middleware->handle($request, function () {
            return response('created', 201)
                ->withCookie(cookie('laravel-session', 'updated-session'));
        });

        $this->assertSame(201, $response->getStatusCode());
        $this->assertFalse($response->headers->has('Set-Cookie'));
    }

    public function test_api_session_endpoints_can_issue_session_cookie(): void
    {
        $middleware = new StripApiReadSessionCookies;
        $request = Request::create('/api/auth/login', 'POST');

        $response = $middleware->handle($request, function () {
            return response('ok', 200)
                ->withCookie(cookie('laravel-session', 'authenticated-session'));
        });

        $this->assertSame(200, $response->getStatusCode());
        $this->assertTrue($response->headers->has('Set-Cookie'));
    }

    public function test_api_reads_do_not_rotate_session_cookie(): void
    {
        $middleware = new StripApiReadSessionCookies;
        $request = Request::create('/api/services', 'GET');

        $response = $middleware->handle($request, function () {
            return response('ok', 200)
                ->withCookie(cookie('laravel-session', 'rotated-session'));
        });

        $this->assertSame(200, $response->getStatusCode());
        $this->assertFalse($response->headers->has('Set-Cookie'));
    }

    public function test_broadcasting_auth_does_not_rotate_session_cookie(): void
    {
        $middleware = new StripApiReadSessionCookies;
        $request = Request::create('/broadcasting/auth', 'POST');

        $response = $middleware->handle($request, function () {
            return response('ok', 200)
                ->withCookie(cookie('laravel-session', 'broadcast-session'));
        });

        $this->assertSame(200, $response->getStatusCode());
        $this->assertFalse($response->headers->has('Set-Cookie'));
    }
}
