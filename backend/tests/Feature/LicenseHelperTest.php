<?php

namespace Tests\Feature;

use App\Models\FiscalSetting;
use App\Support\LicenseHelper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LicenseHelperTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_default_demo_license_when_no_file_exists(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Central',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ]);

        $status = LicenseHelper::checkLicense();

        $this->assertTrue($status['valid']);
        $this->assertEquals('Hospital Central', $status['licensee']);
        $this->assertEquals('08011999123456', $status['rtn']);
        $this->assertNull($status['expires_at']);
        $this->assertEquals('Demo Local / Desarrollo', $status['type']);
    }

    public function test_valid_comercial_license_file(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Central',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ]);

        $licensee = 'Hospital Central';
        $rtn = '08011999123456';
        $expiresAt = '2030-12-31';
        $signature = LicenseHelper::generateSignature($licensee, $rtn, $expiresAt);

        Storage::disk('local')->put('license.json', json_encode([
            'licensee' => $licensee,
            'rtn' => $rtn,
            'expires_at' => $expiresAt,
            'signature' => $signature,
        ]));

        $status = LicenseHelper::checkLicense();

        $this->assertTrue($status['valid']);
        $this->assertEquals($licensee, $status['licensee']);
        $this->assertEquals('Licencia Comercial LAN', $status['type']);
    }

    public function test_invalid_signature_is_blocked(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Central',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ]);

        Storage::disk('local')->put('license.json', json_encode([
            'licensee' => 'Hospital Central',
            'rtn' => '08011999123456',
            'expires_at' => '2030-12-31',
            'signature' => 'FRAUDULENT_SIGNATURE',
        ]));

        $status = LicenseHelper::checkLicense();

        $this->assertFalse($status['valid']);
        $this->assertEquals('Firma Invalida', $status['type']);
    }

    public function test_mismatched_rtn_is_blocked(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Central',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ]);

        $licensee = 'Hospital Central';
        $rtn = '99999999999999'; // licensed RTN differs from current hospital RTN
        $expiresAt = '2030-12-31';
        $signature = LicenseHelper::generateSignature($licensee, $rtn, $expiresAt);

        Storage::disk('local')->put('license.json', json_encode([
            'licensee' => $licensee,
            'rtn' => $rtn,
            'expires_at' => $expiresAt,
            'signature' => $signature,
        ]));

        $status = LicenseHelper::checkLicense();

        $this->assertFalse($status['valid']);
        $this->assertEquals('RTN Incompatible', $status['type']);
    }

    public function test_expired_license_is_blocked(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Central',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ]);

        $licensee = 'Hospital Central';
        $rtn = '08011999123456';
        $expiresAt = '2020-01-01'; // expired long ago
        $signature = LicenseHelper::generateSignature($licensee, $rtn, $expiresAt);

        Storage::disk('local')->put('license.json', json_encode([
            'licensee' => $licensee,
            'rtn' => $rtn,
            'expires_at' => $expiresAt,
            'signature' => $signature,
        ]));

        $status = LicenseHelper::checkLicense();

        $this->assertFalse($status['valid']);
        $this->assertEquals('Licencia Expirada', $status['type']);
    }
}
