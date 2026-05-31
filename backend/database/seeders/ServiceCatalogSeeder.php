<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Category;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class ServiceCatalogSeeder extends Seeder
{
    private const EXPECTED_SERVICE_COUNT = 122;

    private const CATALOG_PATH = 'database/seeders/data/catalogo_servicios_inicial.csv';

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

        DB::transaction(function () use ($rows): void {
            $categoryOrders = [];

            foreach ($rows as $row) {
                $categorySlug = $this->slug($row['categoria']);
                $categorySourceKey = $this->categorySourceKey($row['categoria']);
                $categoryOrders[$categorySlug] ??= count($categoryOrders);
                $area = Area::query()->firstOrCreate(
                    ['slug' => $categorySlug],
                    [
                        'name' => $row['categoria'],
                        'active' => true,
                    ],
                );

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

                $serviceData = [
                    'source_key' => $serviceSourceKey,
                    'name' => $row['servicio'],
                    'area_id' => $area->id,
                    'category_id' => $category->id,
                    'slug' => $serviceSlug,
                    'source_hash' => $this->serviceSourceHash($row),
                    'price' => $row['precio_lps'],
                    'taxable' => $this->truthy($row['taxable']),
                    'active' => true,
                    'special_rule_code' => $this->specialRuleCode($row),
                ];

                if (isset(self::VALIDATION_CODES[$serviceSourceKey])) {
                    $serviceData = array_merge($serviceData, self::VALIDATION_CODES[$serviceSourceKey]);
                }

                $service->fill($serviceData)->save();
            }
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
     * @return list<array{categoria: string, servicio: string, precio_lps: string, taxable: string, regla_especial: string}>
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
            ];

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
     * @param  array{categoria: string, servicio: string, precio_lps: string, taxable: string, regla_especial: string}  $row
     */
    private function serviceSourceHash(array $row): string
    {
        return hash('sha256', implode('|', [
            $this->serviceSourceKey($row),
            $row['servicio'],
            $row['precio_lps'],
            $row['taxable'],
            $row['regla_especial'],
        ]));
    }

    private function categorySourceKey(string $category): string
    {
        return 'csv:category:'.$this->slug($category);
    }

    /**
     * @param  array{categoria: string, servicio: string}  $row
     */
    private function serviceSourceKey(array $row): string
    {
        return 'csv:service:'.$this->slug($row['categoria']).':'.$this->slug($row['servicio']);
    }

    private function slug(string $value): string
    {
        return Str::slug($value);
    }
}
