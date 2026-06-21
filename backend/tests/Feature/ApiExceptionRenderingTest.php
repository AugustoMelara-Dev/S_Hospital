<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class ApiExceptionRenderingTest extends TestCase
{
    public function test_api_500_response_is_sanitized_when_debug_is_disabled(): void
    {
        Config::set('app.debug', false);

        Route::get('/api/_test/unhandled-exception', function (): void {
            throw new RuntimeException(
                "DB_PASSWORD=supersecret failed for 'hospital_app'@'172.18.0.1' at C:\\Projects\\S_Hospital\\backend\\.env"
            );
        });

        $response = $this->getJson('/api/_test/unhandled-exception')
            ->assertStatus(500)
            ->assertJsonPath('code', 'SERVER_ERROR');

        $json = json_encode($response->json(), JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('supersecret', $json);
        $this->assertStringNotContainsString('hospital_app', $json);
        $this->assertStringNotContainsString('172.18.0.1', $json);
        $this->assertStringNotContainsString('C:\\Projects', $json);
        $this->assertStringContainsString('[redacted]', $json);
        $this->assertStringContainsString('[db-user-host]', $json);
        $this->assertStringContainsString('[ruta-local]', $json);
    }
}
