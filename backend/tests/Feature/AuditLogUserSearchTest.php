<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogUserSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_auditor_can_search_all_events_by_name_or_username_without_users_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $auditor = User::factory()->create();
        $auditor->givePermissionTo('audit.view');
        $ana = User::factory()->create(['name' => 'Ana López', 'username' => 'caja.norte']);
        $other = User::factory()->create(['name' => 'Otra Persona', 'username' => 'otro']);
        foreach ([$ana, $other] as $person) {
            AuditLog::query()->create(['user_id' => $person->id, 'action' => 'invoice.voided', 'entity_type' => 'invoice', 'entity_id' => 1, 'reason' => 'Prueba sintética']);
        }
        foreach (['Ana', 'caja.norte'] as $term) {
            $this->actingAs($auditor)->getJson('/api/system/audit-logs?user='.urlencode($term))
                ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.user.username', 'caja.norte');
        }
    }

    public function test_search_still_requires_audit_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->actingAs(User::factory()->create())->getJson('/api/system/audit-logs?user=Ana')->assertForbidden();
    }

    public function test_search_rejects_excessively_long_names(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->givePermissionTo('audit.view');
        $this->actingAs($user)->getJson('/api/system/audit-logs?user='.str_repeat('a', 121))->assertUnprocessable()->assertJsonValidationErrors('user');
    }
}
