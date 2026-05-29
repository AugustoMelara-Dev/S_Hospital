<?php

namespace Database\Seeders;

use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DevelopmentDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $password = Hash::make('Password123!');

        $admin = User::updateOrCreate(
            ['username' => 'admin.demo'],
            [
                'name' => 'Administrador Hospital San Isidro',
                'email' => 'admin.demo@hospital-san-isidro.local',
                'password' => $password,
                'active' => true,
                'must_change_password' => false,
            ],
        );
        $admin->syncRoles(['admin']);

        $supervisor = User::updateOrCreate(
            ['username' => 'supervisor.demo'],
            [
                'name' => 'Supervisor Hospital San Isidro',
                'email' => 'supervisor.demo@hospital-san-isidro.local',
                'password' => $password,
                'active' => true,
                'must_change_password' => false,
            ],
        );
        $supervisor->syncRoles(['supervisor']);

        $cashier = User::updateOrCreate(
            ['username' => 'cajero.demo'],
            [
                'name' => 'Cajero Hospital San Isidro',
                'email' => 'cajero.demo@hospital-san-isidro.local',
                'password' => $password,
                'active' => true,
                'must_change_password' => false,
            ],
        );
        $cashier->syncRoles(['cajero']);

        FiscalSetting::query()->updateOrCreate(
            ['id' => 1],
            [
                'hospital_name' => 'Hospital San Isidro',
                'rtn' => '08011999123456',
                'default_tax_rate' => '15.00',
                'receipt_width' => '80mm',
                'receipt_paper_size' => 'half_letter',
                'receipt_template_mode' => 'institutional',
                'government_line' => 'Gobierno de Honduras',
                'secretariat_line' => 'Secretaria de Salud Publica',
                'receipt_location' => 'Tocoa, Colon',
                'receipt_footer_text' => 'Documento de recaudacion institucional.',
                'scanner_enabled' => false,
                'partial_payments_enabled' => false,
                'created_by' => $admin->id,
                'updated_by' => $admin->id,
            ],
        );

        $sequence = FiscalSequence::query()->firstOrNew(
            [
                'document_type' => 'invoice',
                'prefix' => '000-001-01',
                'cai' => 'CONFIGURACION-PENDIENTE',
            ],
        );

        $maxIssuedNumber = Invoice::query()
            ->where('fiscal_prefix', '000-001-01')
            ->pluck('invoice_number')
            ->map(function (string $invoiceNumber): int {
                $parts = explode('-', $invoiceNumber);

                return (int) end($parts);
            })
            ->max();

        $sequence->fill([
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => max((int) $sequence->current_number, (int) $maxIssuedNumber),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
            'created_by' => $sequence->created_by ?? $admin->id,
            'updated_by' => $admin->id,
        ])->save();
    }
}
