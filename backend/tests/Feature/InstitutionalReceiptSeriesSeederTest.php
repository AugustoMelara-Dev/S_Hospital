<?php

namespace Tests\Feature;

use App\Models\InstitutionalReceiptSeries;
use Database\Seeders\InstitutionalReceiptSeriesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InstitutionalReceiptSeriesSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_institutional_receipt_series_seeder_creates_one_active_default_series(): void
    {
        $this->seed(InstitutionalReceiptSeriesSeeder::class);
        $this->seed(InstitutionalReceiptSeriesSeeder::class);

        $this->assertDatabaseCount('institutional_receipt_series', 1);
        $this->assertDatabaseHas('institutional_receipt_series', [
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'current_number' => 0,
            'range_authorization' => null,
            'active' => true,
        ]);
    }
}
