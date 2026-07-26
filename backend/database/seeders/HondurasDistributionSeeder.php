<?php

namespace Database\Seeders;

use App\Models\FiscalSetting;
use Illuminate\Database\Seeder;

class HondurasDistributionSeeder extends Seeder
{
    public const HOSPITAL_NAME = 'Hospital General San Isidro';

    public const GOVERNMENT_LINE = 'Gobierno de Honduras';

    public const SECRETARIAT_LINE = 'Secretaria de Salud Publica';

    public const RECEIPT_LOCATION = 'Tocoa, Colon, Honduras';

    public const LOCALE = 'es-HN';

    public const TIMEZONE = 'America/Tegucigalpa';

    public const CURRENCY = 'HNL';

    /**
     * Inicializa la identidad institucional con valores canonicos para
     * la distribucion hondureña de S_Hospital. El seeder es idempotente:
     * nunca sobrescribe RTN, CAI, rango, direccion exacta, telefono,
     * lema ni ningun campo que ya contenga un valor oficial cargado por
     * el usuario o un tecnico autorizado.
     */
    public function run(): void
    {
        $setting = FiscalSetting::query()->first() ?? new FiscalSetting;

        $defaults = [
            'hospital_name' => self::HOSPITAL_NAME,
            'government_line' => self::GOVERNMENT_LINE,
            'secretariat_line' => self::SECRETARIAT_LINE,
            'receipt_location' => self::RECEIPT_LOCATION,
        ];

        foreach ($defaults as $field => $value) {
            $current = $setting->getAttribute($field);
            if ($current === null || trim((string) $current) === '') {
                $setting->setAttribute($field, $value);
            }
        }

        $setting->save();
    }
}
