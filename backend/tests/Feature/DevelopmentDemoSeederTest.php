<?php

namespace Tests\Feature;

use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\User;
use Database\Seeders\DevelopmentDemoSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DevelopmentDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seed_data_is_available_only_for_local_or_testing(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(DevelopmentDemoSeeder::class);

        $admin = User::query()->where('username', 'admin.demo')->firstOrFail();
        $cashier = User::query()->where('username', 'cajero.demo')->firstOrFail();

        $this->assertTrue($admin->hasRole('admin'));
        $this->assertTrue($cashier->hasRole('cajero'));
        $this->assertTrue(Hash::check('Password123!', $admin->password));
        $this->assertFalse($admin->must_change_password);
        $this->assertDatabaseHas('fiscal_settings', [
            'id' => 1,
            'hospital_name' => 'Hospital Demo',
            'receipt_width' => '80mm',
        ]);
        $this->assertTrue(FiscalSequence::query()->where('document_type', 'invoice')->where('active', true)->exists());
    }

    public function test_demo_seeder_does_not_create_users_outside_local_or_testing(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->app->detectEnvironment(fn () => 'production');

        (new DevelopmentDemoSeeder)->run();

        $this->assertDatabaseMissing('users', ['username' => 'admin.demo']);
        $this->assertDatabaseMissing('users', ['username' => 'supervisor.demo']);
        $this->assertDatabaseMissing('users', ['username' => 'cajero.demo']);
        $this->assertSame(0, FiscalSetting::query()->count());
        $this->assertFalse(
            FiscalSequence::query()
                ->where('document_type', 'invoice')
                ->where('prefix', '000-001-01')
                ->where('cai', 'DEMO-CAI')
                ->exists(),
        );
    }
}
