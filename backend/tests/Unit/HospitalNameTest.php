<?php

namespace Tests\Unit;

use App\Support\HospitalName;
use PHPUnit\Framework\TestCase;

class HospitalNameTest extends TestCase
{
    public function test_it_uses_a_clean_operational_fallback_for_empty_or_legacy_internal_names(): void
    {
        $this->assertSame('Caja hospitalaria', HospitalName::display(null));
        $this->assertSame('Caja hospitalaria', HospitalName::display(''));
        $this->assertSame('Caja hospitalaria', HospitalName::display('Hospital Billing OS'));
        $this->assertSame('Caja hospitalaria', HospitalName::display('S_Hospital Billing OS'));
    }

    public function test_it_keeps_the_configured_hospital_name_when_it_is_not_a_legacy_internal_name(): void
    {
        $this->assertSame('Hospital San Rafael', HospitalName::display('Hospital San Rafael'));
    }
}
