<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            HondurasDistributionSeeder::class,
            ReceiptPrintProfileSeeder::class,
            InstitutionalReceiptSeriesSeeder::class,
            ServiceCatalogSeeder::class,
            DevelopmentValidationSeeder::class,
        ]);
    }
}
