<?php

namespace Tests\Unit;

use Tests\TestCase;

class ManualQaChecklistTest extends TestCase
{
    public function test_normal_receipt_settings_checklist_keeps_thermal_tickets_out_of_primary_paper_flow(): void
    {
        $contents = file_get_contents(base_path('../docs/manual-qa-checklist.md'));

        $this->assertIsString($contents);
        $this->assertStringContainsString('### 3.1 Usuario normal', $contents);
        $this->assertStringContainsString('### 3.2 Soporte', $contents);

        $normalSection = str($contents)
            ->after('### 3.1 Usuario normal')
            ->before('### 3.2 Soporte')
            ->toString();

        $this->assertStringContainsString('Carta', $normalSection);
        $this->assertStringContainsString('Media carta', $normalSection);
        $this->assertStringContainsString('A5', $normalSection);
        $this->assertStringNotContainsString('Ticket 80 mm', $normalSection);
        $this->assertStringNotContainsString('Ticket 58 mm', $normalSection);
    }
}
