<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ThrottleByUserTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
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

        // Hit /api/auth/session 31 times against the throttle.user:30,1
        // middleware. The 31st call must 429.
        for ($i = 0; $i < 30; $i++) {
            $this->getJson('/api/auth/session')->assertOk();
        }

        $response = $this->getJson('/api/auth/session');

        $response->assertStatus(429)
            ->assertJsonStructure(['message', 'retry_after']);
        $this->assertSame('30', (string) $response->headers->get('X-RateLimit-Limit'));
        $this->assertSame('0', (string) $response->headers->get('X-RateLimit-Remaining'));
    }
}
