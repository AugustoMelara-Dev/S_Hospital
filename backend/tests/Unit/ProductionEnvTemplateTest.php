<?php

namespace Tests\Unit;

use Tests\TestCase;

class ProductionEnvTemplateTest extends TestCase
{
    public function test_environment_templates_do_not_ship_with_debug_enabled(): void
    {
        foreach ([
            '../.env.example',
            '.env.example',
            '.env.docker.example',
            '../docker-compose.prod.yml',
        ] as $relativePath) {
            $contents = file_get_contents(base_path($relativePath));

            $this->assertIsString($contents, $relativePath);
            $this->assertStringNotContainsString('APP_DEBUG=true', $contents, $relativePath);
            $this->assertMatchesRegularExpression('/APP_DEBUG(?:=|:\s*)"?false"?/i', $contents, $relativePath);
        }
    }
}
