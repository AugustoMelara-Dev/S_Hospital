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

    public function test_local_compose_server_preserves_the_container_database_environment(): void
    {
        $contents = file_get_contents(base_path('../docker-compose.yml'));

        $this->assertIsString($contents);
        $this->assertStringNotContainsString(
            'php artisan serve',
            $contents,
            'Artisan serve can rehydrate the mounted .env when it spawns the PHP server and override Compose DB_* values.',
        );
        $this->assertStringContainsString(
            'exec php -S 0.0.0.0:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php',
            $contents,
        );
    }
}
