<?php

namespace Database\Seeders;

use App\Models\InstitutionalReceiptSeries;
use Illuminate\Database\Seeder;

class InstitutionalReceiptSeriesSeeder extends Seeder
{
    public function run(): void
    {
        InstitutionalReceiptSeries::query()->firstOrCreate(
            [
                'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
                'series' => 'REC-A',
            ],
            [
                'prefix' => 'RA',
                'number_format' => '{series}-{number:08}',
                'min_number' => 1,
                'max_number' => 99999999,
                'current_number' => 0,
                'range_authorization' => 'AUT-REC-LOCAL',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'receipt_number_color' => '#b91c1c',
                'active' => true,
                'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
                'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
            ],
        );
    }
}
