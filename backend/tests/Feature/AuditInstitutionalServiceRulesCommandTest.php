<?php

namespace Tests\Feature;

use App\Actions\Catalog\AuditInstitutionalServiceRulesAction;
use App\Models\Service;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditInstitutionalServiceRulesCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_catalog_has_exactly_one_valid_institutional_rule(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $canonical = Service::query()
            ->where('source_key', 'csv:service:medicamentos:eritropoyetina')
            ->firstOrFail();

        $this->assertSame([
            'valid' => true,
            'canonical_service_id' => $canonical->id,
            'unexpected_service_ids' => [],
        ], app(AuditInstitutionalServiceRulesAction::class)->execute());

        $this->artisan('hospital:audit-catalog-rules')
            ->expectsOutputToContain('Regla institucional de eritropoyetina valida.')
            ->assertExitCode(0);
    }

    public function test_ordinary_service_with_rule_is_reported_without_exposing_ids(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $canonical = Service::query()
            ->where('source_key', 'csv:service:medicamentos:eritropoyetina')
            ->firstOrFail();
        $ordinary = Service::query()
            ->where('name', 'Glucosa')
            ->firstOrFail();
        $ordinary->forceFill([
            'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
        ])->save();

        $this->assertSame([
            'valid' => false,
            'canonical_service_id' => $canonical->id,
            'unexpected_service_ids' => [$ordinary->id],
        ], app(AuditInstitutionalServiceRulesAction::class)->execute());

        $this->artisan('hospital:audit-catalog-rules')
            ->expectsOutputToContain('Catalogo institucional invalido.')
            ->doesntExpectOutputToContain((string) $canonical->id)
            ->doesntExpectOutputToContain((string) $ordinary->id)
            ->assertExitCode(1);
    }

    public function test_missing_canonical_service_is_invalid(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        Service::query()
            ->where('source_key', 'csv:service:medicamentos:eritropoyetina')
            ->firstOrFail()
            ->delete();

        $this->assertSame([
            'valid' => false,
            'canonical_service_id' => null,
            'unexpected_service_ids' => [],
        ], app(AuditInstitutionalServiceRulesAction::class)->execute());

        $this->artisan('hospital:audit-catalog-rules')
            ->expectsOutputToContain('Catalogo institucional invalido.')
            ->assertExitCode(1);
    }

    public function test_canonical_service_with_wrong_price_or_tax_is_invalid(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $canonical = Service::query()
            ->where('source_key', 'csv:service:medicamentos:eritropoyetina')
            ->firstOrFail();
        $canonical->forceFill([
            'price' => '900.00',
            'taxable' => true,
        ])->save();

        $this->assertSame([
            'valid' => false,
            'canonical_service_id' => $canonical->id,
            'unexpected_service_ids' => [],
        ], app(AuditInstitutionalServiceRulesAction::class)->execute());
    }
}
