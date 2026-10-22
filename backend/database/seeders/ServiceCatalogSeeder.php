<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Category;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\ServiceArea;
use App\Models\TaxRate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class ServiceCatalogSeeder extends Seeder
{
    private const EXPECTED_SERVICE_COUNT = 151;

    private const CATALOG_PATH = 'database/seeders/data/catalogo_servicios_inicial.csv';

    private const EXEMPT_RATE_NAME = 'Exento 0 %';

    /**
     * Explicit override for the "seed the catalog exempt" behaviour. When null
     * the seeder follows the runtime environment: production installs the seed
     * catalog exempt (owner decision 2026-10-21, H-02/H-15); dev/tests keep the
     * historical CSV `taxable` values so existing suites stay meaningful.
     */
    private ?bool $seedExempt = null;

    public function __construct(?bool $seedExempt = null)
    {
        $this->seedExempt = $seedExempt;
    }

    /**
     * The production installer passes `['seed_exempt' => true]` through
     * `Seeder::call()` so the behaviour is explicit and testable instead of
     * depending on how APP_ENV happens to be set on the build machine.
     *
     * @param  array<string, mixed>  $parameters
     */
    public function __invoke(array $parameters = []): void
    {
        if (array_key_exists('seed_exempt', $parameters)) {
            $this->seedExempt = (bool) $parameters['seed_exempt'];
        }

        parent::__invoke($parameters);
    }

    /**
     * Validation-only operational codes used by barcode/USB scanner validation.
     *
     * @var array<string, array{scan_code: string|null, barcode: string|null, qr_code: string|null}>
     */
    private const VALIDATION_CODES = [
        'csv:service:laboratorio:acido-urico' => [
            'scan_code' => 'LAB-ACIDO-URICO',
            'barcode' => '7700000001001',
            'qr_code' => 'QR-LAB-ACIDO-URICO',
        ],
        'csv:service:radiologia:abdomen-simple' => [
            'scan_code' => 'RX-ABDOMEN',
            'barcode' => '7700000002001',
            'qr_code' => 'QR-RX-ABDOMEN',
        ],
    ];

    public function run(): void
    {
        $rows = $this->readCatalogRows();
        $seedExempt = $this->shouldSeedExempt();

        DB::transaction(function () use ($rows, $seedExempt): void {
            $areas = $this->seedAreas();
            $this->seedServiceAreas();
            $this->ensureTaxRates();
            $categoryOrders = [];

            foreach ($rows as $row) {
                $categorySlug = $this->slug($row['categoria']);
                $categorySourceKey = $this->categorySourceKey($row['categoria']);
                $categoryOrders[$categorySlug] ??= count($categoryOrders);

                $category = Category::query()
                    ->where('source_key', $categorySourceKey)
                    ->orWhere(fn ($query) => $query->whereNull('source_key')->where('slug', $categorySlug))
                    ->firstOrNew();

                $category->fill([
                    'source_key' => $categorySourceKey,
                    'name' => $row['categoria'],
                    'slug' => $categorySlug,
                    'source_hash' => $this->categorySourceHash($row),
                    'active' => true,
                    'sort_order' => $categoryOrders[$categorySlug],
                ])->save();

                $serviceSlug = $this->slug($row['servicio']);
                $serviceSourceKey = $this->serviceSourceKey($row);
                $service = Service::query()
                    ->where('source_key', $serviceSourceKey)
                    ->orWhere(function ($query) use ($category, $serviceSlug): void {
                        $query->whereNull('source_key')
                            ->where('category_id', $category->id)
                            ->where('slug', $serviceSlug);
                    })
                    ->firstOrNew();

                $specialRuleCode = $this->specialRuleCode($row);
                $isNewService = ! $service->exists;
                $metadataData = [
                    'source_key' => $serviceSourceKey,
                    'name' => $row['servicio'],
                    'category_id' => $category->id,
                    'area_id' => $areas[$this->areaSlugForCategory($row['categoria'])]->id ?? null,
                    'slug' => $serviceSlug,
                    'source_hash' => $this->serviceSourceHash($row),
                ];
                $operationalData = [
                    'price' => $row['precio_lps'],
                    // H-02/H-15: a production installation starts with the seed
                    // catalog exempt until the hospital reviews its taxes. Only
                    // NEW rows are seeded; reruns never overwrite an already
                    // administered service (taxable / tax_rate_id are preserved).
                    'taxable' => $seedExempt ? false : $this->truthy($row['taxable']),
                    'tax_rate_id' => null,
                    'active' => $this->truthy($row['activo']),
                    'visible_in_billing' => $this->truthy($row['visible_en_cobro']),
                    'is_billable' => $this->truthy($row['facturable']),
                    'description' => $row['descripcion'] !== '' ? $row['descripcion'] : null,
                    'special_rule_code' => $specialRuleCode,
                ];
                $serviceData = $isNewService
                    ? array_merge($metadataData, $operationalData)
                    : $metadataData;

                if ($row['aliases'] !== '' && ($isNewService || blank($service->aliases))) {
                    $serviceData['aliases'] = $row['aliases'];
                }

                if (isset(self::VALIDATION_CODES[$serviceSourceKey])) {
                    foreach (self::VALIDATION_CODES[$serviceSourceKey] as $field => $value) {
                        if ($isNewService || blank($service->{$field})) {
                            $serviceData[$field] = $value;
                        }
                    }
                }

                $service->fill($serviceData)->save();
            }

            $managedServiceKeys = collect($rows)
                ->map(fn (array $row): string => $this->serviceSourceKey($row))
                ->all();
            $managedCategoryKeys = collect($rows)
                ->map(fn (array $row): string => $this->categorySourceKey($row['categoria']))
                ->unique()
                ->values()
                ->all();

            Service::query()
                ->where('source_key', 'like', 'csv:service:%')
                ->whereNotIn('source_key', $managedServiceKeys)
                ->update([
                    'active' => false,
                    'visible_in_billing' => false,
                    'is_billable' => false,
                ]);

            Category::query()
                ->where('source_key', 'like', 'csv:category:%')
                ->whereNotIn('source_key', $managedCategoryKeys)
                ->whereDoesntHave('services', fn ($query) => $query->where('active', true))
                ->update(['active' => false]);
        });

        $loadedCount = collect($rows)
            ->filter(function (array $row): bool {
                return Service::query()
                    ->where('source_key', $this->serviceSourceKey($row))
                    ->exists();
            })
            ->count();

        if ($loadedCount !== count($rows)) {
            throw new RuntimeException(
                'Catalog seeder expected '.count($rows)." CSV services, loaded {$loadedCount}.",
            );
        }
    }

    /**
     * @return list<array{categoria: string, servicio: string, precio_lps: string, taxable: string, regla_especial: string, source_key: string, activo: string, visible_en_cobro: string, facturable: string, descripcion: string, aliases: string}>
     */
    private function readCatalogRows(): array
    {
        $path = base_path(self::CATALOG_PATH);

        if (! is_file($path)) {
            throw new RuntimeException("Missing service catalog CSV at {$path}.");
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException("Unable to read service catalog CSV at {$path}.");
        }

        $headers = fgetcsv($handle);
        $rows = [];
        $seenServiceKeys = [];

        while (($values = fgetcsv($handle)) !== false) {
            if ($values === [null] || $values === false) {
                continue;
            }

            /** @var array<string, string> $row */
            $row = array_combine($headers ?: [], $values) ?: [];

            if (($row['categoria'] ?? '') === '' || ($row['servicio'] ?? '') === '') {
                continue;
            }

            $normalizedRow = [
                'categoria' => trim($row['categoria']),
                'servicio' => trim($row['servicio']),
                'precio_lps' => $this->price(trim($row['precio_lps'] ?? '0.00')),
                'taxable' => trim($row['taxable'] ?? 'si'),
                'regla_especial' => trim($row['regla_especial'] ?? ''),
                'source_key' => trim($row['source_key'] ?? ''),
                'activo' => trim($row['activo'] ?? 'si'),
                'visible_en_cobro' => trim($row['visible_en_cobro'] ?? 'si'),
                'facturable' => trim($row['facturable'] ?? 'si'),
                'descripcion' => trim($row['descripcion'] ?? ''),
                'aliases' => trim($row['aliases'] ?? ''),
            ];

            if (! preg_match('/^csv:service:[a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/', $normalizedRow['source_key'])) {
                throw new RuntimeException(
                    "Invalid or missing stable source_key for {$normalizedRow['categoria']} / {$normalizedRow['servicio']}.",
                );
            }

            $serviceKey = $this->serviceSourceKey($normalizedRow);

            if (isset($seenServiceKeys[$serviceKey])) {
                throw new RuntimeException(
                    "Duplicate service catalog row for {$normalizedRow['categoria']} / {$normalizedRow['servicio']}.",
                );
            }

            $seenServiceKeys[$serviceKey] = true;
            $rows[] = $normalizedRow;
        }

        fclose($handle);

        if (count($rows) !== self::EXPECTED_SERVICE_COUNT) {
            throw new RuntimeException(
                'Catalog CSV expected '.self::EXPECTED_SERVICE_COUNT.' rows, read '.count($rows).'.',
            );
        }

        return $rows;
    }

    private function price(string $value): string
    {
        $normalized = str_replace(',', '.', trim($value));

        if (! preg_match('/^\d+(\.\d{1,2})?$/', $normalized)) {
            throw new RuntimeException("Invalid service catalog price [{$value}].");
        }

        [$integer, $decimal] = array_pad(explode('.', $normalized, 2), 2, '00');

        return $integer.'.'.str_pad(substr($decimal, 0, 2), 2, '0');
    }

    private function truthy(string $value): bool
    {
        return in_array(Str::lower($value), ['si', 'yes', 'true', '1'], true);
    }

    /**
     * @param  array{servicio: string, precio_lps: string, regla_especial: string}  $row
     */
    private function specialRuleCode(array $row): ?string
    {
        if ($this->normalized($row['servicio']) === 'eritropoyetina') {
            return Service::ERYTHROPOIETIN_RULE;
        }

        if ($this->normalized($row['regla_especial']) === 'eritropoyetina gratis con receta dialisis') {
            return Service::ERYTHROPOIETIN_RULE;
        }

        return null;
    }

    private function normalized(string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', Str::of($value)->ascii()->lower()->replace('_', ' ')->value()) ?? '');
    }

    /**
     * @param  array{categoria: string}  $row
     */
    private function categorySourceHash(array $row): string
    {
        return hash('sha256', $this->categorySourceKey($row['categoria']).'|'.$row['categoria']);
    }

    /**
     * @param  array{categoria: string, servicio: string, precio_lps: string, taxable: string, regla_especial: string, source_key: string, activo: string, visible_en_cobro: string, facturable: string, descripcion: string, aliases: string}  $row
     */
    private function serviceSourceHash(array $row): string
    {
        return hash('sha256', implode('|', [
            $this->serviceSourceKey($row),
            $row['servicio'],
            $row['precio_lps'],
            $row['taxable'],
            $row['regla_especial'],
            $row['activo'],
            $row['visible_en_cobro'],
            $row['facturable'],
            $row['descripcion'],
            $row['aliases'],
        ]));
    }

    private function categorySourceKey(string $category): string
    {
        return 'csv:category:'.$this->slug($category);
    }

    /**
     * @return array<string, Area>
     */
    private function seedAreas(): array
    {
        $areas = [
            ['name' => 'Laboratorio'],
            ['name' => 'Rayos X'],
            ['name' => 'Emergencia'],
            ['name' => 'Consulta externa'],
            ['name' => 'Farmacia'],
        ];

        $seeded = [];

        foreach ($areas as $area) {
            $slug = $this->slug($area['name']);
            $seeded[$slug] = Area::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $area['name'],
                    'active' => true,
                ],
            );
        }

        return $seeded;
    }

    private function seedServiceAreas(): void
    {
        $areas = [
            ['name' => 'Laboratorio', 'sort_order' => 1],
            ['name' => 'Rayos X', 'sort_order' => 2],
            ['name' => 'Emergencia', 'sort_order' => 3],
            ['name' => 'Consulta externa', 'sort_order' => 4],
            ['name' => 'Farmacia', 'sort_order' => 5],
            ['name' => 'Otros', 'sort_order' => 99],
        ];

        foreach ($areas as $area) {
            ServiceArea::query()->updateOrCreate(
                ['slug' => $this->slug($area['name'])],
                [
                    'name' => $area['name'],
                    'active' => true,
                    'sort_order' => $area['sort_order'],
                ],
            );
        }
    }

    private function areaSlugForCategory(string $category): string
    {
        return match ($this->slug($category)) {
            'laboratorio' => 'laboratorio',
            'radiologia' => 'rayos-x',
            'servicios-generales' => 'emergencia',
            'medicamentos' => 'farmacia',
            'odontologia' => 'consulta-externa',
            default => 'otros',
        };
    }

    /**
     * @param  array{source_key: string}  $row
     */
    private function serviceSourceKey(array $row): string
    {
        return $row['source_key'];
    }

    private function shouldSeedExempt(): bool
    {
        return $this->seedExempt ?? app()->environment('production');
    }

    /**
     * Guarantees the fiscal rate catalog has a usable starting point without
     * inventing a hospital-specific tax decision:
     *  - if no rate is marked default and `fiscal_settings.default_tax_rate`
     *    is positive, that configured rate is created (or promoted) as default;
     *  - an "Exento 0 %" row is always available for explicit exemption.
     *
     * Existing defaults are never replaced: once the hospital configures
     * Ajustes → Impuestos, rerunning the installer must not change them.
     */
    private function ensureTaxRates(): void
    {
        $hasDefault = TaxRate::query()->where('is_default', true)->exists();

        if (! $hasDefault) {
            $percentage = $this->storedDefaultTaxRate();

            if ($percentage !== null && (float) $percentage > 0) {
                $rate = TaxRate::query()
                    ->where('percentage', $percentage)
                    ->orderBy('id')
                    ->first();

                if ($rate === null) {
                    TaxRate::query()->create([
                        'name' => 'ISV '.$this->compactRate($percentage).' %',
                        'percentage' => $percentage,
                        'active' => true,
                        'is_default' => true,
                    ]);
                } else {
                    $rate->forceFill(['is_default' => true])->save();
                }
            }
        }

        if (! TaxRate::query()->where('percentage', '0.00')->exists()) {
            TaxRate::query()->create([
                'name' => self::EXEMPT_RATE_NAME,
                'percentage' => '0.00',
                'active' => true,
                'is_default' => false,
            ]);
        }
    }

    private function storedDefaultTaxRate(): ?string
    {
        $raw = FiscalSetting::query()->first()?->getAttributes()['default_tax_rate'] ?? null;

        if (is_int($raw) || is_float($raw)) {
            // SQLite may return the decimal column as a native number.
            $raw = number_format((float) $raw, 2, '.', '');
        }

        if (! is_string($raw)) {
            return null;
        }

        $trimmed = trim($raw);

        if (! preg_match('/^\d+(\.\d{1,2})?$/', $trimmed)) {
            return null;
        }

        [$integer, $decimal] = array_pad(explode('.', $trimmed, 2), 2, '00');

        return $integer.'.'.str_pad(substr($decimal, 0, 2), 2, '0');
    }

    private function compactRate(string $percentage): string
    {
        return rtrim(rtrim($percentage, '0'), '.');
    }

    private function slug(string $value): string
    {
        return Str::slug($value);
    }
}
