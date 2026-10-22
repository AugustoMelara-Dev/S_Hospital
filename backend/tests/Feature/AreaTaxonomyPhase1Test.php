<?php

namespace Tests\Feature;

use App\Actions\Billing\CalculateInvoiceTotalsAction;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * F016 fase 1 (T2-040): diagnostico de taxonomia de areas.
 *
 * Verifica con datos reales de seeders que:
 * - todos los servicios apuntan a un area canonica existente (`areas`);
 * - no existe ningun area legacy (`service_areas`) REFERENCIADA por usuarios o
 *   por snapshots de `invoice_items` sin contraparte canonica por slug;
 * - el preflight de la futura fase 2 detecta esos huecos cuando aparecen;
 * - el consumidor vigente `CalculateInvoiceTotalsAction` sigue mapeando el
 *   snapshot legacy por slug (y deja null si no hay contraparte).
 *
 * Portable SQLite/MariaDB: solo usa SQL estandar y seeders.
 */
class AreaTaxonomyPhase1Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(ServiceCatalogSeeder::class);
    }

    public function test_seeded_services_point_to_an_existing_canonical_area(): void
    {
        $this->assertGreaterThan(0, (int) DB::table('services')->count());

        $invalid = (int) DB::table('services as s')
            ->leftJoin('areas as a', 'a.id', '=', 's.area_id')
            ->where(function ($query): void {
                $query->whereNull('s.area_id')->orWhereNull('a.id');
            })
            ->count();

        $this->assertSame(0, $invalid, 'Todo servicio del catalogo seed debe tener un area canonica valida.');
    }

    public function test_no_referenced_legacy_area_lacks_a_canonical_counterpart_on_seeded_data(): void
    {
        $this->assertSame(0, $this->referencedLegacyGapCount());
    }

    public function test_phase2_preflight_detects_referenced_legacy_area_without_counterpart(): void
    {
        $legacyId = (int) DB::table('service_areas')->insertGetId([
            'name' => 'Cardiologia Legacy T2040',
            'slug' => 'cardiologia-legacy-t2040',
            'active' => 1,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        User::factory()->create(['service_area_id' => $legacyId]);

        $gaps = $this->referencedLegacySlugs();

        $this->assertSame(
            ['cardiologia-legacy-t2040'],
            $gaps,
            'El preflight de fase 2 debe detectar un area legacy referenciada y sin contraparte canonica.'
        );
    }

    public function test_otros_has_a_canonical_counterpart_after_the_mapping_migration(): void
    {
        $canonical = DB::table('areas')->where('slug', 'otros')->first();
        $legacy = DB::table('service_areas')->where('slug', 'otros')->first();

        $this->assertNotNull($legacy, 'El seed base incluye el area legacy "Otros".');
        $this->assertNotNull($canonical, 'La migracion F016 fase 1 debe mapear "otros" a `areas`.');
        $this->assertSame('Otros', $canonical->name);
    }

    public function test_all_seeded_legacy_areas_have_a_canonical_counterpart(): void
    {
        $pairs = DB::table('service_areas as sa')
            ->leftJoin('areas as a', 'a.slug', '=', 'sa.slug')
            ->select('sa.slug', 'sa.id as service_area_id', 'a.id as area_id')
            ->orderBy('sa.id')
            ->get();

        $legacyOnly = $pairs->filter(fn (object $pair): bool => $pair->area_id === null)->pluck('slug')->values()->all();

        $this->assertSame([], $legacyOnly, 'Ningun area legacy debe quedar sin contraparte canonica tras la fase 1.');
        $this->assertCount(6, $pairs);
    }

    public function test_invoice_totals_action_still_maps_legacy_snapshot_by_slug(): void
    {
        $area = DB::table('areas')->where('slug', 'laboratorio')->first();
        $serviceArea = DB::table('service_areas')->where('slug', 'laboratorio')->first();

        $this->assertNotNull($area);
        $this->assertNotNull($serviceArea);

        $service = Service::query()
            ->where('area_id', $area->id)
            ->whereNull('special_rule_code')
            ->first();

        $this->assertInstanceOf(Service::class, $service);

        $totals = app(CalculateInvoiceTotalsAction::class)->execute(
            [['service' => $service, 'quantity' => '1', 'notes' => null]],
            '15.00',
        );

        $item = $totals['items'][0];

        $this->assertSame((int) $area->id, $item['area_id']);
        $this->assertSame((int) $serviceArea->id, $item['service_area_id']);
        $this->assertSame('Laboratorio', $item['area_name']);
        $this->assertSame('Laboratorio', $item['service_area_name']);
    }

    public function test_legacy_snapshot_is_null_when_the_area_has_no_legacy_counterpart(): void
    {
        $baseService = Service::query()
            ->whereNull('special_rule_code')
            ->firstOrFail();

        $areaId = (int) DB::table('areas')->insertGetId([
            'name' => 'Cardiologia T2040',
            'slug' => 'cardiologia-t2040',
            'active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $serviceId = (int) DB::table('services')->insertGetId([
            'category_id' => $baseService->category_id,
            'area_id' => $areaId,
            'name' => 'Prueba Taxonomia T2040',
            'slug' => 'prueba-taxonomia-t2040',
            'price' => '1.00',
            'taxable' => 0,
            'active' => 1,
            'visible_in_billing' => 1,
            'is_billable' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $service = Service::query()->findOrFail($serviceId);

        $totals = app(CalculateInvoiceTotalsAction::class)->execute(
            [['service' => $service, 'quantity' => '1', 'notes' => null]],
            '15.00',
        );

        $item = $totals['items'][0];

        $this->assertSame($areaId, $item['area_id'], 'El snapshot canonico si se llena.');
        $this->assertNull($item['service_area_id'], 'Sin contraparte legacy por slug, el snapshot legacy queda null; comportamiento documentado de fase 1.');
    }

    private function referencedLegacyGapCount(): int
    {
        return count($this->referencedLegacySlugs());
    }

    /**
     * Areas legacy referenciadas (users o invoice_items) sin contraparte en
     * `areas` por slug. Query del preflight de fase 2.
     *
     * @return list<string>
     */
    private function referencedLegacySlugs(): array
    {
        return DB::table('service_areas as sa')
            ->leftJoin('areas as a', 'a.slug', '=', 'sa.slug')
            ->whereNull('a.id')
            ->where(function ($query): void {
                $query->whereExists(function ($subquery): void {
                    $subquery->selectRaw('1')->from('users')->whereColumn('users.service_area_id', 'sa.id');
                })->orWhereExists(function ($subquery): void {
                    $subquery->selectRaw('1')->from('invoice_items')->whereColumn('invoice_items.service_area_id', 'sa.id');
                });
            })
            ->orderBy('sa.id')
            ->pluck('sa.slug')
            ->map(fn (mixed $slug): string => (string) $slug)
            ->values()
            ->all();
    }
}
