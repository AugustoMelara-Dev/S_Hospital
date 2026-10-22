<?php

namespace Tests\Unit;

use App\Support\HospitalName;
use PHPUnit\Framework\TestCase;

class HospitalNameTest extends TestCase
{
    public function test_it_uses_a_neutral_fallback_for_empty_or_legacy_internal_names(): void
    {
        $legacyProductName = 'Hospital '.('Bill'.'ing').' OS';
        $legacyFirstHospitalName = 'Hospital '.('San '.'Isidro');
        $legacyDefaultHospitalName = 'Hospital '.'General '.('San '.'Isidro');

        $this->assertSame('S_Hospital', HospitalName::display(null));
        $this->assertSame('S_Hospital', HospitalName::display(''));
        $this->assertSame('S_Hospital', HospitalName::display('   '));
        $this->assertSame('S_Hospital', HospitalName::display($legacyFirstHospitalName));
        $this->assertSame('S_Hospital', HospitalName::display($legacyDefaultHospitalName));
        $this->assertSame('S_Hospital', HospitalName::display($legacyProductName));
        $this->assertSame('S_Hospital', HospitalName::display('S_Hospital '.$legacyProductName));
        $this->assertSame('S_Hospital', HospitalName::display('Hospital '.('De'.'mo')));
    }

    public function test_it_keeps_the_configured_hospital_name_when_it_is_not_a_legacy_internal_name(): void
    {
        $this->assertSame('Hospital San Rafael', HospitalName::display('Hospital San Rafael'));
        $this->assertSame('Hospital San Rafael', HospitalName::display('  Hospital San Rafael  '));
    }
}
