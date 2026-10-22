<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class EchoConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_offline_default_disables_realtime_without_a_socket_server(): void
    {
        Config::set('broadcasting.default', 'null');
        Config::set('broadcasting.connections.pusher.key', '');
        $user = User::factory()->create();

        // H-10: with no socket server (production default), the client must be
        // told realtime is disabled so it never imports pusher-js nor retries.
        $this->actingAs($user)->getJson('/api/system/echo-config')
            ->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.key', '');
    }

    public function test_wss_client_configuration_is_reported_as_tls(): void
    {
        Config::set('app.url', 'https://hospital.local');
        Config::set('broadcasting.default', 'pusher');
        Config::set('broadcasting.connections.pusher.key', 'client-key');
        Config::set('broadcasting.connections.pusher.options.host', 'soketi');
        Config::set('broadcasting.connections.pusher.options.scheme', 'http');
        Config::set('broadcasting.connections.pusher.client_options', [
            'host' => 'hospital.local',
            'port' => 443,
            'scheme' => 'wss',
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/system/echo-config')
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.host', 'hospital.local')
            ->assertJsonPath('data.port', 443)
            ->assertJsonPath('data.scheme', 'https')
            ->assertJsonPath('data.useTLS', true);
    }

    public function test_plain_ws_configuration_stays_plain_http(): void
    {
        Config::set('app.url', 'http://192.168.1.10:8000');
        Config::set('broadcasting.default', 'pusher');
        Config::set('broadcasting.connections.pusher.key', 'client-key');
        Config::set('broadcasting.connections.pusher.client_options', [
            'host' => '192.168.1.10',
            'port' => 6001,
            'scheme' => 'WS',
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/system/echo-config')
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.host', '192.168.1.10')
            ->assertJsonPath('data.port', 6001)
            ->assertJsonPath('data.scheme', 'http')
            ->assertJsonPath('data.useTLS', false);
    }

    public function test_https_server_scheme_is_used_when_the_client_scheme_is_missing(): void
    {
        Config::set('app.url', 'https://192.168.1.10');
        Config::set('broadcasting.default', 'pusher');
        Config::set('broadcasting.connections.pusher.key', 'client-key');
        Config::set('broadcasting.connections.pusher.options.host', 'soketi');
        Config::set('broadcasting.connections.pusher.options.scheme', 'https');
        Config::set('broadcasting.connections.pusher.client_options', [
            'host' => '192.168.1.10',
            'port' => 443,
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/system/echo-config')
            ->assertOk()
            ->assertJsonPath('data.scheme', 'https')
            ->assertJsonPath('data.useTLS', true);
    }
}
