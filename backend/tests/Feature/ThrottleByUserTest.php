<?php

declare(strict_types=1);

namespace Tests\Feature;

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

        Route::middleware(['web', 'auth:web', 'throttle.user:2,1'])
            ->get('/_test/throttle-by-user', fn () => response()->json(['ok' => true]));
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
            $this->getJson('/_test/throttle-by-user')->assertOk();
        }

        $response = $this->getJson('/_test/throttle-by-user');

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
        $this->getJson('/_test/throttle-by-user')->assertOk();
        $this->getJson('/_test/throttle-by-user')->assertOk();
        $this->getJson('/_test/throttle-by-user')->assertStatus(429);

        $this->actingAs($second, 'web');
        $this->getJson('/_test/throttle-by-user')->assertOk();
    }

    public function test_invoice_write_routes_use_per_user_throttle(): void
    {
        $invoiceStore = Route::getRoutes()->match(Request::create('/api/invoices', 'POST'));
        $invoiceVoid = Route::getRoutes()->match(Request::create('/api/invoices/1/void', 'POST'));

        $this->assertContains('throttle.user:60,1', $invoiceStore->gatherMiddleware());
        $this->assertContains('throttle.user:30,1', $invoiceVoid->gatherMiddleware());
    }
}
