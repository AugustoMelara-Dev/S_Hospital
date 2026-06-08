<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaintenanceModeTest extends TestCase
{
    use RefreshDatabase;

    private string $downFile;

    protected function setUp(): void
    {
        parent::setUp();

        $this->downFile = storage_path('framework/down');
        @unlink($this->downFile);
    }

    protected function tearDown(): void
    {
        @unlink($this->downFile);

        parent::tearDown();
    }

    public function test_maintenance_command_writes_and_removes_safe_payload(): void
    {
        $this->artisan('hospital:maintenance', [
            'action' => 'on',
            '--message' => 'Revisión segura de red local',
        ])->assertExitCode(0);

        $this->assertFileExists($this->downFile);

        $payload = json_decode((string) file_get_contents($this->downFile), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame('Revisión segura de red local', $payload['message'] ?? null);
        $this->assertSame(503, $payload['status'] ?? null);
        $this->assertArrayNotHasKey('secret', $payload);

        $this->artisan('hospital:maintenance', [
            'action' => 'off',
        ])->assertExitCode(0);

        $this->assertFileDoesNotExist($this->downFile);
    }

    public function test_html_maintenance_page_uses_human_spanish_copy(): void
    {
        $this->writeMaintenancePayload('Revisión segura de red local');

        $this->get('/login')
            ->assertStatus(503)
            ->assertSee('Sistema en mantenimiento')
            ->assertSee('Revisión segura de red local')
            ->assertSee('atención inmediata')
            ->assertDontSee("\u{00C3}", false);
    }

    public function test_api_maintenance_response_uses_human_json_without_details(): void
    {
        $this->writeMaintenancePayload('Revisión segura de red local');

        $this->getJson('/api/health')
            ->assertStatus(503)
            ->assertJsonPath('message', 'Sistema en mantenimiento. Vuelva a intentar en unos minutos.')
            ->assertDontSee('framework/down')
            ->assertDontSee('APP_KEY')
            ->assertDontSee("\u{00C3}", false);
    }

    private function writeMaintenancePayload(string $message): void
    {
        file_put_contents($this->downFile, json_encode([
            'time' => now()->timestamp,
            'message' => $message,
            'retry' => 60,
            'status' => 503,
        ], JSON_THROW_ON_ERROR));
    }
}
