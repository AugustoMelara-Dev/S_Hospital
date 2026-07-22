<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class CriticalLanPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_billing_search_reduces_candidates_in_sql_before_fuzzy_ranking(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('catalog.view');
        $category = Category::factory()->create(['active' => true]);

        Service::factory()->count(1000)->create([
            'category_id' => $category->id,
        ]);
        Service::factory()->create([
            'category_id' => $category->id,
            'name' => 'Glucosa basal',
            'aliases' => 'glicemia basal',
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)
            ->getJson('/api/services?billing=1&search=glucosa&per_page=24');

        $response
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.name', 'Glucosa basal');

        $serviceQueries = collect(DB::getQueryLog())
            ->pluck('query')
            ->filter(fn (string $query): bool => preg_match('/from\s+[`"]services[`"]/i', $query) === 1);

        $this->assertNotEmpty($serviceQueries);
        $this->assertTrue(
            $serviceQueries->contains(fn (string $query): bool => preg_match('/\blike\b/i', $query) === 1),
            "La búsqueda debe reducir candidatos en SQL antes de ejecutar el ranking difuso en PHP.\n".$serviceQueries->implode("\n"),
        );
        $this->assertTrue(
            $serviceQueries->contains(fn (string $query): bool => preg_match('/\blimit\b/i', $query) === 1),
            "La consulta de resultados debe paginar en SQL y no cargar todos los candidatos en memoria.\n".$serviceQueries->implode("\n"),
        );
    }
}
