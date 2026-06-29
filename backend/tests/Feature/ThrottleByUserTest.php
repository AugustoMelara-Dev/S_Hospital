<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Middleware\LoginLockout;
use App\Http\Middleware\ThrottleByUser;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ThrottleByUserTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        Route::middleware(['web', 'auth:web', ThrottleByUser::class.':2,1'])
            ->get('/api/_test/throttle-by-user', fn () => response()->json(['ok' => true]));
    }

    public function test_per_user_throttle_returns_429_with_safe_message(): void
    {
        User::factory()->create([
            'username' => 'cajero-throttle',
            'email' => 'cajero-throttle@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('cajero');

        // Authenticate so the middleware can resolve the user id.
        $user = User::where('username', 'cajero-throttle')->firstOrFail();
        $this->actingAs($user, 'web');

        for ($i = 0; $i < 2; $i++) {
            $this->getJson('/api/_test/throttle-by-user')->assertOk();
        }

        $response = $this->getJson('/api/_test/throttle-by-user');

        $response->assertStatus(429)
            ->assertJsonStructure(['message', 'retry_after'])
            ->assertJsonPath('message', 'Demasiadas solicitudes locales para su usuario. Por favor espere antes de repetir.');
        $this->assertSame('2', (string) $response->headers->get('X-RateLimit-Limit'));
        $this->assertSame('0', (string) $response->headers->get('X-RateLimit-Remaining'));
    }

    public function test_per_user_throttle_does_not_block_another_cashier_on_same_lan_ip(): void
    {
        $first = User::factory()->create([
            'username' => 'cajero-throttle-a',
            'email' => 'cajero-throttle-a@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ]);
        $second = User::factory()->create([
            'username' => 'cajero-throttle-b',
            'email' => 'cajero-throttle-b@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ]);

        $this->actingAs($first, 'web');
        $this->getJson('/api/_test/throttle-by-user')->assertOk();
        $this->getJson('/api/_test/throttle-by-user')->assertOk();
        $this->getJson('/api/_test/throttle-by-user')->assertStatus(429);

        $this->flushSession();
        $this->actingAs($second, 'web');
        $this->getJson('/api/_test/throttle-by-user')->assertOk();
    }

    public function test_invoice_write_routes_use_per_user_throttle(): void
    {
        $invoiceStore = Route::getRoutes()->match(Request::create('/api/invoices', 'POST'));
        $invoiceVoid = Route::getRoutes()->match(Request::create('/api/invoices/1/void', 'POST'));

        $this->assertContains('throttle.user:60,1', $invoiceStore->gatherMiddleware());
        $this->assertContains('throttle.user:30,1', $invoiceVoid->gatherMiddleware());
    }

    public function test_login_route_keeps_lan_safe_ip_throttle_with_failed_attempt_lockout(): void
    {
        $route = Route::getRoutes()->match(Request::create('/api/auth/login', 'POST'));

        $this->assertContains('throttle:30,1', $route->gatherMiddleware());
        $this->assertContains(LoginLockout::class, $route->gatherMiddleware());
    }

    public function test_operational_read_routes_use_per_user_lan_safe_throttle(): void
    {
        $routes = [
            Request::create('/api/cash-sessions/current', 'GET'),
            Request::create('/api/settings/fiscal', 'GET'),
            Request::create('/api/reports/dashboard', 'GET'),
            Request::create('/api/admin/users', 'GET'),
            Request::create('/api/backups', 'GET'),
            Request::create('/api/system/status', 'GET'),
        ];

        foreach ($routes as $request) {
            $route = Route::getRoutes()->match($request);

            $this->assertContains(
                'throttle.user:240,1',
                $route->gatherMiddleware(),
                sprintf('%s %s should not share the global IP throttle bucket', $request->method(), $request->path()),
            );
        }
    }

    public function test_operational_write_routes_keep_bounded_per_user_throttles(): void
    {
        $routes = [
            [Request::create('/api/settings/fiscal', 'PUT'), 'throttle.user:30,1'],
            [Request::create('/api/cash-sessions/open', 'POST'), 'throttle.user:30,1'],
            [Request::create('/api/backups', 'POST'), 'throttle.user:20,1'],
            [Request::create('/api/admin/users', 'POST'), 'throttle.user:30,1'],
            [Request::create('/api/invoices/1/payments', 'POST'), 'throttle.user:60,1'],
            [Request::create('/api/invoices/1/reprint', 'POST'), 'throttle.user:30,1'],
        ];

        foreach ($routes as [$request, $expectedMiddleware]) {
            $route = Route::getRoutes()->match($request);

            $this->assertContains(
                $expectedMiddleware,
                $route->gatherMiddleware(),
                sprintf('%s %s must keep an explicit write throttle', $request->method(), $request->path()),
            );
        }
    }

    public function test_sensitive_download_routes_keep_strong_per_user_throttles(): void
    {
        $routes = [
            [Request::create('/api/reports/export', 'GET'), 'throttle.user:30,1'],
            [Request::create('/api/reports/pdf', 'GET'), 'throttle.user:20,1'],
            [Request::create('/api/backups/1/download', 'GET'), 'throttle.user:10,1'],
        ];

        foreach ($routes as [$request, $expectedMiddleware]) {
            $route = Route::getRoutes()->match($request);

            $this->assertContains(
                $expectedMiddleware,
                $route->gatherMiddleware(),
                sprintf('%s %s must keep a sensitive download throttle', $request->method(), $request->path()),
            );
        }
    }
}
