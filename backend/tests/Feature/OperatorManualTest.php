<?php

namespace Tests\Feature;

use Tests\TestCase;

class OperatorManualTest extends TestCase
{
    public function test_operator_index_points_lan_validation_to_evidence_script(): void
    {
        $manualPath = base_path('../docs/manuales/INDICE_OPERADOR.md');

        if (! is_file($manualPath)) {
            $this->markTestSkipped('Operator manuals are outside the mounted backend tree in this environment.');
        }

        $manual = (string) file_get_contents($manualPath);

        $this->assertStringContainsString('scripts\validate_lan_client.ps1', $manual);
        $this->assertStringContainsString('-EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md', $manual);
        $this->assertStringNotContainsString('scripts\ping_lan_clients.ps1 -ServerUrl', $manual);
    }
}
