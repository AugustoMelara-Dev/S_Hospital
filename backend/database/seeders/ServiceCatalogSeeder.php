<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class ServiceCatalogSeeder extends Seeder
{
    private const EXPECTED_SERVICE_COUNT = 122;

    public function run(): void
    {
        $rows = $this->readCatalogRows();

        DB::transaction(function () use ($rows): void {
            $categoryOrders = [];

            foreach ($rows as $row) {
                $categorySlug = Str::slug($row['categoria']);
                $categoryOrders[$categorySlug] ??= count($categoryOrders);

                $category = Category::query()->updateOrCreate(
                    ['slug' => $categorySlug],
                    [
                        'name' => $row['categoria'],
                        'active' => true,
                        'sort_order' => $categoryOrders[$categorySlug],
                    ],
                );

                Service::query()->updateOrCreate(
                    [
                        'category_id' => $category->id,
                        'slug' => Str::slug($row['servicio']),
                    ],
                    [
                        'name' => $row['servicio'],
                        'price' => $this->price($row['precio_lps']),
                        'taxable' => $this->truthy($row['taxable']),
                        'active' => true,
                        'special_rule_code' => $this->specialRuleCode($row),
                    ],
                );
            }
        });

        $loadedCount = collect($rows)
            ->filter(function (array $row): bool {
                $category = Category::query()->where('slug', Str::slug($row['categoria']))->first();

                return $category !== null
                    && Service::query()
                        ->where('category_id', $category->id)
                        ->where('slug', Str::slug($row['servicio']))
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
        $path = base_path('../catalogo_servicios_inicial.csv');

        if (! is_file($path)) {
            throw new RuntimeException("Missing service catalog CSV at {$path}.");
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException("Unable to read service catalog CSV at {$path}.");
        }

        $headers = fgetcsv($handle);
        $rows = [];

        while (($values = fgetcsv($handle)) !== false) {
            if ($values === [null] || $values === false) {
                continue;
            }

            /** @var array<string, string> $row */
            $row = array_combine($headers ?: [], $values) ?: [];

            if (($row['categoria'] ?? '') === '' || ($row['servicio'] ?? '') === '') {
                continue;
            }

            $rows[] = [
                'categoria' => trim($row['categoria']),
                'servicio' => trim($row['servicio']),
                'precio_lps' => trim($row['precio_lps'] ?? '0.00'),
                'taxable' => trim($row['taxable'] ?? 'si'),
                'regla_especial' => trim($row['regla_especial'] ?? ''),
            ];
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
        return number_format((float) str_replace(',', '.', $value), 2, '.', '');
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
}
