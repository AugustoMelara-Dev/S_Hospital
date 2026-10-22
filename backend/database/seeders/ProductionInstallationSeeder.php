<?php

namespace Database\Seeders;

use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use Illuminate\Database\Seeder;

/**
 * Datos maestros mínimos de una instalación productiva nueva.
 *
 * Este seeder se ejecuta únicamente desde el instalador nativo. No crea
 * usuarios, operaciones ni configuración fiscal. Tras crear el primer usuario
 * autorizado, el primer inicio debe completar identidad institucional, RTN,
 * tasa vigente y una secuencia fiscal activa con CAI, rango y vencimiento reales.
 * Hasta entonces GenerateFiscalNumberAction bloquea la emisión de facturas.
 */
class ProductionInstallationSeeder extends Seeder
{
    public function run(): void
    {
        $hasPrintProfiles = ReceiptPrintProfile::query()->exists();
        $hasInstitutionalSeries = InstitutionalReceiptSeries::query()
            ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
            ->exists();

        $this->call([
            RolesAndPermissionsSeeder::class,
            CashRegisterSeeder::class,
        ]);

        if (! $hasPrintProfiles) {
            $this->call(ReceiptPrintProfileSeeder::class);

            // La instalación nueva entrega dos ejemplares sobre carta vertical.
            // Con la plantilla compacta y la configuración two_zone_sheet esto
            // activa las dos zonas y su línea de corte; nunca altera un perfil
            // que ya hubiese sido configurado por el hospital.
            ReceiptPrintProfile::query()
                ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
                ->update(['copies_mode' => 'original_first']);
        }

        if (! $hasInstitutionalSeries) {
            // Es numeración del comprobante institucional, sin CAI ni rango
            // fiscal inventado. Una serie existente siempre se conserva.
            $this->call(InstitutionalReceiptSeriesSeeder::class);
        }

        // Fuente productiva: CSV institucional. El seeder conserva precio,
        // impuestos y estado de los servicios ya administrados en reintentos.
        $this->call(ServiceCatalogSeeder::class);
    }
}
