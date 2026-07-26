<?php

namespace Tests\Feature;

use App\Http\Controllers\FiscalSettingsController;
use App\Http\Controllers\InstitutionalReceiptSettingsController;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\HondurasDistributionSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionClass;
use Tests\TestCase;

class PreInstallationAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_institution_endpoint_is_not_a_separate_write_path_to_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $reflection = new ReflectionClass(InstitutionalReceiptSettingsController::class);
        $updateMethod = $reflection->getMethod('updateInstitution');
        $fileSource = file($reflection->getFileName());
        $body = implode('', array_slice(
            $fileSource,
            $updateMethod->getStartLine() - 1,
            $updateMethod->getEndLine() - $updateMethod->getStartLine() + 1,
        ));

        $this->assertStringContainsString(
            'UpdateFiscalInstitutionAction',
            $body,
            'updateInstitution debe inyectar y delegar al caso de uso canonico UpdateFiscalInstitutionAction.',
        );

        $this->assertStringContainsString(
            '$action->execute(',
            $body,
            'updateInstitution debe ejecutar el caso de uso canonico en lugar de duplicar la escritura.',
        );

        $this->assertStringContainsString(
            'use App\\Actions\\Fiscal\\UpdateFiscalInstitutionAction;',
            implode('', $fileSource),
            'El controlador debe importar el caso de uso canonico.',
        );

        $this->assertStringNotContainsString(
            '$setting->fill(',
            $body,
            'updateInstitution no debe replicar la asignacion de campos; debe delegar.',
        );

        $this->assertStringNotContainsString(
            "FiscalSetting::query()->first() ?? new FiscalSetting",
            $body,
            'updateInstitution no debe volver a resolver FiscalSetting directamente.',
        );

        $this->assertStringNotContainsString(
            'institutional_receipt.settings.updated',
            implode('', $fileSource),
            'updateInstitution no debe seguir emitiendo una accion de auditoria paralela a fiscal_settings.',
        );
    }

    public function test_fiscal_settings_uses_a_single_canonical_use_case(): void
    {
        $reflection = new ReflectionClass(FiscalSettingsController::class);
        $update = $reflection->getMethod('update');

        $this->assertTrue(
            $update->isPublic(),
            'FiscalSettingsController::update debe ser el unico caso de uso canonico para la identidad institucional.',
        );
    }

    public function test_receipt_series_color_is_optional_in_form_request(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $admin = $admin->refresh();

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'prefix' => 'RA',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'receipt_number_color' => '#b91c1c',
            'active' => true,
            'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
            'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/series/{$series->id}", [
                'series' => 'REC-A',
                'prefix' => 'RA',
                'number_format' => '{series}-{number:08}',
                'min_number' => 1,
                'max_number' => 99999999,
                'current_number' => 0,
                'active' => true,
                'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
                'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
            ]);

        $response->assertOk();
        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_print_profile_save_does_not_require_receipt_number_color_field(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(\Database\Seeders\ReceiptPrintProfileSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $admin = $admin->refresh();

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $response = $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'copies_mode' => 'original_first',
                'show_physical_seal_space' => true,
                'use_logo' => false,
                'active' => true,
                'is_global_default' => true,
                'template_code' => 'institutional_classic',
            ]);

        $response->assertOk();
    }

    public function test_honduras_distribution_seeder_exists_and_is_idempotent(): void
    {
        $seeder = new HondurasDistributionSeeder;
        $reflection = new ReflectionClass($seeder);

        $this->assertTrue(
            $reflection->hasMethod('run'),
            'Debe existir HondurasDistributionSeeder::run().',
        );

        $this->assertSame('Hospital General San Isidro', HondurasDistributionSeeder::HOSPITAL_NAME);
        $this->assertSame('Gobierno de Honduras', HondurasDistributionSeeder::GOVERNMENT_LINE);
        $this->assertSame('Secretaria de Salud Publica', HondurasDistributionSeeder::SECRETARIAT_LINE);
        $this->assertStringContainsString('Tocoa', HondurasDistributionSeeder::RECEIPT_LOCATION);
    }

    public function test_honduras_distribution_seeder_populates_only_when_empty(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => '',
            'rtn' => '',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
            'primary_color' => 'indigo',
            'receipt_paper_size' => 'half_letter',
        ]);

        (new HondurasDistributionSeeder)->run();

        $settings = FiscalSetting::query()->first();
        $this->assertSame('Hospital General San Isidro', $settings->hospital_name);
        $this->assertSame('Gobierno de Honduras', $settings->government_line);
        $this->assertSame('Secretaria de Salud Publica', $settings->secretariat_line);
        $this->assertStringContainsString('Tocoa', (string) $settings->receipt_location);
        $this->assertSame('', (string) $settings->rtn);
        $this->assertSame('', (string) $settings->address);
        $this->assertSame('', (string) $settings->phone);
        $this->assertSame('', (string) $settings->slogan);
    }

    public function test_honduras_distribution_seeder_does_not_overwrite_official_data(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital General San Isidro Oficial',
            'rtn' => '08019999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
            'primary_color' => 'indigo',
            'receipt_paper_size' => 'half_letter',
            'government_line' => 'Linea oficial aprobada',
            'secretariat_line' => 'Secretaria oficial',
            'receipt_location' => 'Tegucigalpa oficial',
        ]);

        (new HondurasDistributionSeeder)->run();

        $settings = FiscalSetting::query()->first();
        $this->assertSame('Hospital General San Isidro Oficial', $settings->hospital_name);
        $this->assertSame('08019999123456', $settings->rtn);
        $this->assertSame('Linea oficial aprobada', $settings->government_line);
        $this->assertSame('Secretaria oficial', $settings->secretariat_line);
        $this->assertSame('Tegucigalpa oficial', $settings->receipt_location);
    }

    public function test_database_seeder_calls_honduras_distribution_seeder(): void
    {
        $seeder = new DatabaseSeeder;
        $reflection = new ReflectionClass($seeder);
        $source = implode('', file($reflection->getFileName()));

        $this->assertTrue(
            str_contains($source, 'HondurasDistributionSeeder::class')
                || str_contains($source, HondurasDistributionSeeder::class),
            'DatabaseSeeder debe invocar HondurasDistributionSeeder.',
        );
    }
}
