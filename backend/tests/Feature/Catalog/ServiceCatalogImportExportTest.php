<?php

namespace Tests\Feature\Catalog;

use App\Models\Area;
use App\Models\Category;
use App\Models\Service;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ServiceCatalogImportExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
        Area::query()->create([
            'name' => 'Laboratorio',
            'slug' => 'laboratorio',
            'active' => true,
        ]);
    }

    public function test_preview_validates_rows_without_writing_anything(): void
    {
        $rate = $this->rate('ISV 15 %', '15.00');
        $csv = implode("\n", [
            'categoria,area,servicio,precio_lps,taxable,tax_rate,tax_rate_percentage,activo,visible_en_cobro,facturable,descripcion,aliases',
            'Laboratorio clinico,Laboratorio,Glucosa,15.00,si,ISV 15 %,15.00,si,si,si,Azucar en sangre,',
            'Laboratorio clinico,Laboratorio,Precio roto,abc,si,ISV 15 %,15.00,si,si,si,,',
            'Laboratorio clinico,Laboratorio,Tasa inexistente,10.00,si,ISV 99 %,99.00,si,si,si,,',
        ]);

        $response = $this->actingAs($this->admin())
            ->post('/api/services/import', [
                'file' => UploadedFile::fake()->createWithContent('catalogo.csv', $csv),
                'mode' => 'preview',
            ])
            ->assertOk()
            ->assertJsonPath('data.valid', 1)
            ->assertJsonPath('data.applied', 0)
            ->assertJsonCount(2, 'data.errors');

        $this->assertSame(3, $response->json('data.errors.0.line'));
        $this->assertSame(4, $response->json('data.errors.1.line'));
        $this->assertStringContainsString('precio', $response->json('data.errors.0.message'));

        $this->assertSame(0, Service::query()->count());
        $this->assertSame(0, Category::query()->count());
        $this->assertSame($rate->id, TaxRate::query()->sole()->id);
    }

    public function test_apply_imports_valid_rows_with_their_tax_rate_and_audits(): void
    {
        $rate = $this->rate('ISV 18 %', '18.00');
        $csv = implode("\n", [
            'categoria,area,servicio,precio_lps,taxable,tax_rate,tax_rate_percentage,activo,visible_en_cobro,facturable,descripcion,aliases',
            'Laboratorio clinico,Laboratorio,Glucosa,15.00,si,ISV 18 %,18.00,si,si,si,Azucar en sangre,Glu',
            'Laboratorio clinico,Laboratorio,Perfil lipidico,45.50,no,,,si,si,si,,',
        ]);

        $this->actingAs($this->admin())
            ->post('/api/services/import', [
                'file' => UploadedFile::fake()->createWithContent('catalogo.csv', $csv),
                'mode' => 'apply',
                'reason' => 'Importacion del catalogo del hospital.',
            ])
            ->assertOk()
            ->assertJsonPath('data.valid', 2)
            ->assertJsonPath('data.applied', 2)
            ->assertJsonCount(0, 'data.errors');

        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $this->assertSame('15.00', (string) $glucose->price);
        $this->assertSame($rate->id, $glucose->tax_rate_id);
        $this->assertTrue($glucose->taxable);
        $this->assertSame('Glu', $glucose->aliases);

        $lipids = Service::query()->where('name', 'Perfil lipidico')->firstOrFail();
        $this->assertNull($lipids->tax_rate_id);
        $this->assertFalse($lipids->taxable);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'service.catalog_imported',
            'reason' => 'Importacion del catalogo del hospital.',
        ]);
    }

    public function test_apply_is_idempotent_for_the_same_service(): void
    {
        $this->rate('ISV 15 %', '15.00');
        $csv = implode("\n", [
            'categoria,servicio,precio_lps,tax_rate',
            'Laboratorio,Glucosa,15.00,ISV 15 %',
        ]);

        foreach ([1, 2] as $attempt) {
            $this->actingAs($this->admin())
                ->post('/api/services/import', [
                    'file' => UploadedFile::fake()->createWithContent('catalogo.csv', $csv),
                    'mode' => 'apply',
                ])
                ->assertOk()
                ->assertJsonPath('data.applied', 1);
        }

        $this->assertSame(1, Service::query()->count());
        $this->assertSame(1, Category::query()->count());
    }

    public function test_xlsx_import_preview_reads_the_first_sheet(): void
    {
        $this->rate('ISV 15 %', '15.00');
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->fromArray([
            ['categoria', 'area', 'servicio', 'precio_lps', 'tax_rate'],
            ['Laboratorio', 'Laboratorio', 'Hemograma', '35.00', 'ISV 15 %'],
            ['Laboratorio', 'Laboratorio', 'Sin tasa', '5.00', ''],
        ], null, 'A1');
        $path = tempnam(sys_get_temp_dir(), 'catalogo-').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        try {
            $this->actingAs($this->admin())
                ->post('/api/services/import', [
                    'file' => new UploadedFile(
                        $path,
                        'catalogo.xlsx',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        null,
                        true,
                    ),
                    'mode' => 'preview',
                ])
                ->assertOk()
                ->assertJsonPath('data.valid', 2)
                ->assertJsonPath('data.applied', 0)
                ->assertJsonCount(0, 'data.errors');
        } finally {
            @unlink($path);
        }

        $this->assertSame(0, Service::query()->count());
    }

    public function test_import_rejects_a_file_without_required_headers(): void
    {
        $this->actingAs($this->admin())
            ->post('/api/services/import', [
                'file' => UploadedFile::fake()->createWithContent('catalogo.csv', "nombre,precio\nGlucosa,10.00\n"),
                'mode' => 'preview',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_csv_export_contains_the_catalog_tax_columns(): void
    {
        $rate = $this->rate('ISV 15 %', '15.00');
        $category = Category::factory()->create(['name' => 'Laboratorio']);
        $area = Area::query()->where('slug', 'laboratorio')->firstOrFail();
        Service::factory()->create([
            'category_id' => $category->id,
            'area_id' => $area->id,
            'name' => 'Glucosa',
            'slug' => 'glucosa',
            'price' => '15.00',
            'taxable' => true,
            'tax_rate_id' => $rate->id,
        ]);

        $response = $this->actingAs($this->admin())
            ->get('/api/services/export?format=csv')
            ->assertOk();

        $content = $response->streamedContent();
        $this->assertStringContainsString('tax_rate', $content);
        $this->assertStringContainsString('tax_rate_percentage', $content);
        $this->assertStringContainsString('Glucosa', $content);
        $this->assertStringContainsString('ISV 15 %', $content);
        $this->assertStringContainsString('15.00', $content);
    }

    public function test_xlsx_export_can_be_read_back(): void
    {
        $rate = $this->rate('ISV 18 %', '18.00');
        $category = Category::factory()->create(['name' => 'Laboratorio']);
        Service::factory()->create([
            'category_id' => $category->id,
            'area_id' => Area::query()->where('slug', 'laboratorio')->firstOrFail()->id,
            'name' => 'Hemograma',
            'slug' => 'hemograma',
            'price' => '35.00',
            'taxable' => true,
            'tax_rate_id' => $rate->id,
        ]);

        $response = $this->actingAs($this->admin())
            ->get('/api/services/export?format=xlsx')
            ->assertOk();

        $path = tempnam(sys_get_temp_dir(), 'export-').'.xlsx';
        file_put_contents($path, $response->streamedContent());

        try {
            $spreadsheet = IOFactory::load($path);
            $rows = $spreadsheet->getActiveSheet()->toArray(null, true, false, false);
        } finally {
            @unlink($path);
        }

        $this->assertSame('categoria', $rows[0][0]);
        $this->assertContains('tax_rate', $rows[0]);
        $this->assertContains('Hemograma', array_map('strval', $rows[1]));
        $this->assertContains('18.00', array_map('strval', $rows[1]));
    }

    public function test_cashier_can_export_but_cannot_import(): void
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->get('/api/services/export?format=csv')
            ->assertOk();

        $this->actingAs($cashier)
            ->post('/api/services/import', [
                'file' => UploadedFile::fake()->createWithContent('catalogo.csv', "categoria,servicio,precio_lps\nA,B,1.00\n"),
                'mode' => 'preview',
            ])
            ->assertForbidden();
    }

    private function admin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user->refresh();
    }

    private function rate(string $name, string $percentage): TaxRate
    {
        return TaxRate::query()->create([
            'name' => $name,
            'percentage' => $percentage,
            'active' => true,
            'is_default' => true,
        ]);
    }
}
