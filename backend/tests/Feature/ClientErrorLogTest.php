<?php

namespace Tests\Feature;

use App\Models\ClientErrorLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientErrorLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_store_sanitized_client_issue(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('cajero');

        $this->actingAs($user)
            ->postJson('/api/system/client-errors', [
                'event_type' => 'api_error',
                'severity' => 'warning',
                'safe_message' => 'No tiene permiso para esta accion. DB_PASSWORD=secret contraseña=secret',
                'technical_code' => 'HTTP_403',
                'route' => '/reports?patient=Nombre Privado',
                'status_code' => 403,
                'context' => [
                    'module' => 'reports',
                    'screen' => 'reports',
                    'request_body' => 'no guardar',
                    'stack' => 'no guardar',
                ],
                'occurred_at' => now()->toISOString(),
            ])
            ->assertCreated()
            ->assertJsonPath('data.id', 1);

        $this->assertDatabaseHas('client_error_logs', [
            'user_id' => $user->id,
            'event_type' => 'api_error',
            'severity' => 'warning',
            'technical_code' => 'HTTP_403',
            'route' => '/reports',
            'status_code' => 403,
        ]);

        $log = ClientErrorLog::query()->firstOrFail();
        $this->assertStringNotContainsString('secret', $log->safe_message);
        $this->assertStringNotContainsString('contraseña', $log->safe_message);
        $this->assertSame([
            'module' => 'reports',
            'screen' => 'reports',
        ], $log->context_json);
    }

    public function test_guest_cannot_store_client_issue(): void
    {
        $this->postJson('/api/system/client-errors', [
            'event_type' => 'api_error',
            'severity' => 'error',
            'safe_message' => 'Servidor no disponible.',
        ])->assertUnauthorized();
    }
}
