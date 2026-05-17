<?php

namespace Database\Seeders;

use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
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
                'name' => 'Admin Demo',
                'email' => 'admin.demo@hospital-billing.local',
                'password' => $password,
                'active' => true,
                'must_change_password' => false,
            ],
        );
        $admin->syncRoles(['admin']);

        $supervisor = User::updateOrCreate(
            ['username' => 'supervisor.demo'],
            [
                'name' => 'Supervisor Demo',
                'email' => 'supervisor.demo@hospital-billing.local',
                'password' => $password,
                'active' => true,
                'must_change_password' => false,
            ],
        );
        $supervisor->syncRoles(['supervisor']);

        $cashier = User::updateOrCreate(
            ['username' => 'cajero.demo'],
            [
                'name' => 'Cajero Demo',
                'email' => 'cajero.demo@hospital-billing.local',
                'password' => $password,
                'active' => true,
                'must_change_password' => false,
            ],
        );
        $cashier->syncRoles(['cajero']);

        FiscalSetting::query()->updateOrCreate(
            ['id' => 1],
            [
                'hospital_name' => 'Hospital Demo',
                'rtn' => '08011999123456',
                'default_tax_rate' => '15.00',
                'receipt_width' => '80mm',
                'created_by' => $admin->id,
                'updated_by' => $admin->id,
            ],
        );

        FiscalSequence::query()->updateOrCreate(
            [
                'document_type' => 'invoice',
                'prefix' => '000-001-01',
                'cai' => 'DEMO-CAI',
            ],
            [
                'min_number' => 1,
                'max_number' => 99999999,
                'current_number' => 0,
                'valid_until' => now()->addYear()->toDateString(),
                'active' => true,
                'created_by' => $admin->id,
                'updated_by' => $admin->id,
            ],
        );
    }
}
